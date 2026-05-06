"""Core processing pipeline.

Orchestrates the end-to-end flow for each denial record:
  1. Resolve canonical reason code
  2. Look up scenario config
  3. Apply field aliases to source DataFrames
  4. Execute the appropriate join
  5. Run validation rules (with divestiture preprocessing if applicable)
  6. Build the output row dict (11 standard + 12 divestiture columns)

All decisions are driven by the RulesBrain config; no hardcoded business
rules live here beyond the safety guardrails mandated in the spec.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

import pandas as pd

from .errors import MissingSourceColumnError
from .field_mapper import build_alias_index, get_canonical_df
from .file_registry import FileRegistry
from .join_engine import JoinResult, join_denial_to_source, join_with_fallback_keys
from .reason_code_mapper import ReasonCodeMapper
from .schemas import RulesBrain, ScenarioConfig
from .validation_engine import ScenarioResult, evaluate_scenario_rules

log = logging.getLogger(__name__)

DENIAL_REQUIRED_COLS = ["Claim_ID", "Denial_ID", "Reason_Code"]

# Pass-through fields copied from denial row into every output row
_DENIAL_PASSTHROUGH = [
    "Divestiture_Related_Flag",
    "Invoice_Date",
    "Submission_Date",
    "Submitted_Manufacturer",
    "Expected_Manufacturer",
]


def _safe_str(val: Any) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    return str(val).strip()


def _to_date(val: Any) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, pd.Timestamp):
        return val.date() if not pd.isna(val) else None
    if isinstance(val, date):
        # datetime is a subclass of date; normalize to plain date
        return val if type(val) is date else val.date() if hasattr(val, "date") else val
    try:
        parsed = pd.to_datetime(str(val))
        return parsed.date()
    except Exception:
        return None


def _source_label(scenario: ScenarioConfig) -> str:
    if scenario.primary_source_display:
        return scenario.primary_source_display
    return scenario.primary_source.replace("_", " ").title()


# ---------------------------------------------------------------------------
# Divestiture helpers
# ---------------------------------------------------------------------------

def _is_divestiture_denial(denial_row: dict) -> bool:
    """True when the denial is divestiture-related per EB spec."""
    flag = _safe_str(denial_row.get("Divestiture_Related_Flag", "")).lower()
    code = _safe_str(denial_row.get("Reason_Code", "")).upper()
    return flag == "yes" or code.startswith("DIVEST_")


def _compute_ownership(denial_row: dict, merged: dict) -> dict:
    """Derive ownership-determination fields (EB_R1).

    Ownership is determined by Invoice_Date vs Divestiture_Effective_Date.
    Returns a dict of derived fields to be injected into the merged record
    and eventually into the output row.
    """
    invoice_date = _to_date(denial_row.get("Invoice_Date") or merged.get("Invoice_Date"))
    divest_date = _to_date(merged.get("Divestiture_Effective_Date"))
    prior_mfr = _safe_str(merged.get("Prior_Manufacturer") or merged.get("Prior_Vendor_ID", ""))
    current_mfr = _safe_str(merged.get("Current_Manufacturer") or merged.get("Current_Vendor_ID", ""))
    trans_flag = _safe_str(merged.get("Transitional_Pricing_Flag", "")).lower()
    trans_end = _to_date(merged.get("Transition_End_Date"))

    if invoice_date is None or divest_date is None:
        return {
            "_ownership_determination": "Ownership could not be determined: missing Invoice_Date or Divestiture_Effective_Date.",
            "_transition_period_flag": "Unknown",
            "_expected_manufacturer": current_mfr or prior_mfr,
        }

    if invoice_date < divest_date:
        ownership_text = (
            f"Invoice date {invoice_date} is before divestiture effective date {divest_date}; "
            f"expected manufacturer is {prior_mfr or 'prior owner'}."
        )
        expected_mfr = prior_mfr
        in_transition = False
    else:
        ownership_text = (
            f"Invoice date {invoice_date} is on/after divestiture effective date {divest_date}; "
            f"expected manufacturer is {current_mfr or 'current owner'}."
        )
        expected_mfr = current_mfr
        # Transitional pricing applies when flag is Yes and still within the transition window
        in_transition = (
            trans_flag == "yes"
            and trans_end is not None
            and invoice_date <= trans_end
        )

    return {
        "_ownership_determination": ownership_text,
        "_transition_period_flag": "Yes" if in_transition else "No",
        "_expected_manufacturer": expected_mfr,
    }


def _check_trade_letter_override(merged: dict) -> bool:
    """EB_R7: Trade Letter in data files overrides all other rules."""
    mat_flag = _safe_str(merged.get("Trade_Letter_Override_Flag", "")).lower()
    con_flag = _safe_str(merged.get("denial_Trade_Letter_Override_Flag", "")).lower()
    return mat_flag == "yes" or con_flag == "yes"


def _get_secondary_source(scenario: ScenarioConfig, merged: dict, is_divest: bool) -> str:
    """Determine the Secondary_Source_Checked value for this row."""
    if is_divest and _check_trade_letter_override(merged):
        return "Trade Letter"
    # Derive from secondary join sources listed in the scenario
    secondary = getattr(scenario, "secondary_join_keys", [])
    if not secondary:
        return ""
    return "Material Master"


def _determine_denial_decision(agent_status: str) -> tuple[str, str]:
    """Return (Denial_Decision, Resubmission_Recommended) based on agent_status."""
    if agent_status == "Ready for Resubmission Review":
        return "Resubmission Candidate", "Yes"
    if agent_status == "Closed - Research Complete":
        return "Acceptable Denial", "No"
    return "", "No"


def _determine_data_validation_result(v_result: ScenarioResult) -> str:
    """Summarise the validation outcome as a short label."""
    if v_result.agent_status == "Needs Manual Review":
        # Check if any rule explicitly failed vs errored
        has_fail = any(not rr.passed for rr in v_result.rule_results)
        return "Mismatch" if has_fail else "Missing"
    return ""


def _build_discrepancy_details(v_result: ScenarioResult, merged: dict, is_divest: bool) -> str:
    """Build a concise discrepancy description for divestiture rows."""
    if not is_divest:
        return ""
    failed = [rr for rr in v_result.rule_results if not rr.passed and rr.finding]
    if not failed:
        return ""
    return " | ".join(rr.finding for rr in failed[:3])  # cap at 3 to keep concise


def _enrich_with_material_master(merged: dict, denial_row: dict, source_dfs: dict[str, pd.DataFrame]) -> dict:
    """For divestiture rows whose primary source is NOT material_master, do a secondary
    lookup to pull divestiture-specific fields (Divestiture_Effective_Date, Prior/Current_Manufacturer, etc.)
    """
    mat_df = source_dfs.get("material_master")
    if mat_df is None or mat_df.empty:
        return merged

    # Already have the critical field — no need to look up
    if merged.get("Divestiture_Effective_Date") and str(merged["Divestiture_Effective_Date"]).strip() not in ("", "nan", "NaT"):
        return merged

    material_id = _safe_str(merged.get("Material_ID") or denial_row.get("Material_ID"))
    ndc = _safe_str(merged.get("NDC") or denial_row.get("NDC"))

    match_row = None
    if material_id:
        matches = mat_df[mat_df.get("Material_ID", pd.Series(dtype=str)).astype(str) == material_id]
        if not matches.empty:
            match_row = matches.iloc[0].to_dict()
    if match_row is None and ndc:
        matches = mat_df[mat_df.get("NDC", pd.Series(dtype=str)).astype(str) == ndc]
        if not matches.empty:
            match_row = matches.iloc[0].to_dict()

    if match_row:
        # Only backfill fields that are missing in merged (don't overwrite primary source data)
        divestiture_fields = [
            "Divestiture_Effective_Date", "Divestiture_Flag",
            "Prior_Manufacturer", "Current_Manufacturer",
            "Transitional_Pricing_Flag", "Transition_End_Date",
            "Trade_Letter_Override_Flag",
        ]
        for field in divestiture_fields:
            if field not in merged or not merged[field] or str(merged[field]).strip() in ("", "nan", "NaT"):
                merged[field] = match_row.get(field, "")

    return merged


def _extract_passthrough(denial_row: dict) -> dict:
    """Pull pass-through denial fields into the output row."""
    return {field: _safe_str(denial_row.get(field, "")) for field in _DENIAL_PASSTHROUGH}


# ---------------------------------------------------------------------------
# Base output row builders (updated to include empty divestiture columns)
# ---------------------------------------------------------------------------

def _base_empty_divest_fields() -> dict:
    """Empty placeholders for all divestiture-specific output columns."""
    return {
        "Divestiture_Related_Flag": "",
        "Invoice_Date": "",
        "Submission_Date": "",
        "Submitted_Manufacturer": "",
        "Expected_Manufacturer": "",
        "Ownership_Determination": "",
        "Transition_Period_Flag": "",
        "Secondary_Source_Checked": "",
        "Data_Validation_Result": "",
        "Discrepancy_Details": "",
        "Denial_Decision": "",
        "Resubmission_Recommended": "No",
    }


def _unknown_code_row(denial_row: dict, raw_code: str, defaults) -> dict:
    row = {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": raw_code,
        "Primary_Source_Checked": "Multiple Sources",
        "Research_Finding": "Unknown reason code. No configured rule found.",
        "Recommended_Next_Action": "Manual review required.",
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": "Needs Manual Review",
    }
    row.update(_base_empty_divest_fields())
    row.update(_extract_passthrough(denial_row))
    return row


def _ambiguous_code_row(denial_row: dict, raw_code: str, defaults) -> dict:
    row = {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": raw_code,
        "Primary_Source_Checked": "Multiple Sources",
        "Research_Finding": (
            f"Reason code '{raw_code}' is ambiguous after normalisation and "
            "maps to multiple configured scenarios."
        ),
        "Recommended_Next_Action": "Manual review required.",
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": "Needs Manual Review",
    }
    row.update(_base_empty_divest_fields())
    row.update(_extract_passthrough(denial_row))
    return row


def _data_missing_row(denial_row: dict, canonical_code: str, scenario: ScenarioConfig, defaults) -> dict:
    row = {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": canonical_code,
        "Primary_Source_Checked": _source_label(scenario),
        "Research_Finding": "No matching source record found.",
        "Recommended_Next_Action": "Verify source data availability and correct record identifiers.",
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": scenario.default_agent_status_no_match,
    }
    row.update(_base_empty_divest_fields())
    row.update(_extract_passthrough(denial_row))
    return row


def _duplicate_match_row(denial_row: dict, canonical_code: str, scenario: ScenarioConfig, defaults, count: int) -> dict:
    row = {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": canonical_code,
        "Primary_Source_Checked": _source_label(scenario),
        "Research_Finding": (
            f"Duplicate matching source records found ({count} matches). "
            "Cannot determine correct record without manual review."
        ),
        "Recommended_Next_Action": "Resolve duplicate source records before processing.",
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": "Needs Manual Review",
    }
    row.update(_base_empty_divest_fields())
    row.update(_extract_passthrough(denial_row))
    return row


def _missing_contract_row(denial_row: dict, scenario: ScenarioConfig, defaults) -> dict:
    row = {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": "MISSING_CONTRACT",
        "Primary_Source_Checked": "Contract Data",
        "Research_Finding": "No matching contract found.",
        "Recommended_Next_Action": (
            scenario.default_recommended_next_action
            or "Research contract coverage and confirm correct contract assignment."
        ),
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": "Closed - Research Complete",
        "Denial_Decision": "Acceptable Denial",
        "Resubmission_Recommended": "No",
    }
    row.update(_base_empty_divest_fields())
    row.update(_extract_passthrough(denial_row))
    # Override with correct values after passthrough update
    row["Denial_Decision"] = "Acceptable Denial"
    row["Resubmission_Recommended"] = "No"
    return row


# ---------------------------------------------------------------------------
# Per-row processor
# ---------------------------------------------------------------------------


def _process_row(
    denial_row: dict,
    brain: RulesBrain,
    reason_mapper: ReasonCodeMapper,
    alias_index: dict,
    source_dfs: dict[str, pd.DataFrame],
) -> dict:
    raw_code = _safe_str(denial_row.get("Reason_Code", ""))
    defaults = brain.output_defaults
    is_divest = _is_divestiture_denial(denial_row)

    if not raw_code:
        return _unknown_code_row(denial_row, raw_code, defaults)

    canonical, status_hint = reason_mapper.resolve(raw_code)

    if status_hint == "ambiguous":
        return _ambiguous_code_row(denial_row, raw_code, defaults)

    if status_hint == "unknown" or canonical is None:
        return _unknown_code_row(denial_row, raw_code, defaults)

    scenario = brain.scenarios.get(canonical)
    if scenario is None:
        return _unknown_code_row(denial_row, raw_code, defaults)

    # ------------------------------------------------------------------
    # Special handling: MISSING_CONTRACT
    # Expected result is *no match* — that is the positive finding.
    # ------------------------------------------------------------------
    if canonical == "MISSING_CONTRACT":
        source_df = source_dfs.get(scenario.primary_source)
        if source_df is None:
            out = _data_missing_row(denial_row, canonical, scenario, defaults)
            out["Research_Finding"] = "Source data for contract lookup is unavailable."
            return out
        join_result = join_denial_to_source(denial_row, source_df, scenario)
        if join_result.status == "no_match":
            return _missing_contract_row(denial_row, scenario, defaults)
        # Contract was actually found — unexpected; report for manual review
        row = {
            "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
            "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
            "Reason_Code": canonical,
            "Primary_Source_Checked": "Contract Data",
            "Research_Finding": "Matching contract was found in Contract Data.",
            "Recommended_Next_Action": "Review contract assignment and validate claim.",
            "ECC_Update_Type": defaults.ecc_update_type,
            "Financial_Posting_Allowed": defaults.financial_posting_allowed,
            "Pricing_Change_Allowed": defaults.pricing_change_allowed,
            "Agent_Status": "Needs Manual Review",
        }
        row.update(_base_empty_divest_fields())
        row.update(_extract_passthrough(denial_row))
        return row

    # ------------------------------------------------------------------
    # All other scenarios: join then validate
    # ------------------------------------------------------------------
    source_df = source_dfs.get(scenario.primary_source)
    if source_df is None:
        out = _data_missing_row(denial_row, canonical, scenario, defaults)
        out["Research_Finding"] = f"Source '{scenario.primary_source}' is not available."
        return out

    join_result = join_with_fallback_keys(denial_row, source_df, scenario)

    if join_result.status == "no_match":
        return _data_missing_row(denial_row, canonical, scenario, defaults)

    if join_result.status == "duplicate":
        return _duplicate_match_row(denial_row, canonical, scenario, defaults, len(join_result.rows))

    # Merge: source fields win for canonical names; denial fields stored under denial_ prefix
    merged = {**denial_row, **join_result.matched_row}
    for k, v in denial_row.items():
        merged[f"denial_{k}"] = v

    # ------------------------------------------------------------------
    # Divestiture preprocessing (EB_R1–EB_R7)
    # ------------------------------------------------------------------
    divest_computed: dict = {}
    if is_divest:
        # For scenarios where primary source is not material_master, backfill
        # divestiture fields (Divestiture_Effective_Date, Prior/Current_Manufacturer, etc.)
        if scenario.primary_source != "material_master":
            merged = _enrich_with_material_master(merged, denial_row, source_dfs)
        divest_computed = _compute_ownership(denial_row, merged)
        merged.update(divest_computed)

        # EB_R7: Trade Letter override short-circuits validation
        if _check_trade_letter_override(merged):
            trade_letter_finding = (
                "Trade Letter override flag is active. "
                "All rules superseded by Trade Letter instructions."
            )
            row = {
                "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
                "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
                "Reason_Code": canonical,
                "Primary_Source_Checked": _source_label(scenario),
                "Research_Finding": trade_letter_finding,
                "Recommended_Next_Action": "Apply Trade Letter instructions. Document only.",
                "ECC_Update_Type": defaults.ecc_update_type,
                "Financial_Posting_Allowed": defaults.financial_posting_allowed,
                "Pricing_Change_Allowed": defaults.pricing_change_allowed,
                "Agent_Status": "Ready for Resubmission Review",
                "Secondary_Source_Checked": "Trade Letter",
                "Data_Validation_Result": "",
                "Discrepancy_Details": "",
                "Denial_Decision": "Resubmission Candidate",
                "Resubmission_Recommended": "Yes",
                "Ownership_Determination": divest_computed.get("_ownership_determination", ""),
                "Transition_Period_Flag": divest_computed.get("_transition_period_flag", ""),
            }
            row.update(_extract_passthrough(denial_row))
            return row

    # ------------------------------------------------------------------
    # Run validation rules
    # ------------------------------------------------------------------
    rules = brain.validation_rules.get(canonical, [])
    v_result = evaluate_scenario_rules(rules, merged)

    recommended_action = v_result.recommended_next_action or scenario.default_recommended_next_action
    secondary_source = _get_secondary_source(scenario, merged, is_divest)
    denial_decision, resubmission_rec = _determine_denial_decision(v_result.agent_status)
    data_val_result = _determine_data_validation_result(v_result)
    discrepancy = _build_discrepancy_details(v_result, merged, is_divest)

    row = {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": canonical,
        "Primary_Source_Checked": _source_label(scenario),
        "Research_Finding": v_result.research_finding,
        "Recommended_Next_Action": recommended_action,
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": v_result.agent_status,
        "Secondary_Source_Checked": secondary_source,
        "Data_Validation_Result": data_val_result,
        "Discrepancy_Details": discrepancy,
        "Denial_Decision": denial_decision,
        "Resubmission_Recommended": resubmission_rec,
        "Ownership_Determination": divest_computed.get("_ownership_determination", ""),
        "Transition_Period_Flag": divest_computed.get("_transition_period_flag", ""),
    }
    row.update(_base_empty_divest_fields())  # set all divestiture keys to "" first
    row.update(_extract_passthrough(denial_row))  # overwrite with actual denial values
    # Restore computed/derived fields that may have been overwritten by the above two calls
    row["Secondary_Source_Checked"] = secondary_source
    row["Data_Validation_Result"] = data_val_result
    row["Discrepancy_Details"] = discrepancy
    row["Denial_Decision"] = denial_decision
    row["Resubmission_Recommended"] = resubmission_rec
    row["Ownership_Determination"] = divest_computed.get("_ownership_determination", "")
    row["Transition_Period_Flag"] = divest_computed.get("_transition_period_flag", "")

    return row


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def process_claims(
    brain: RulesBrain,
    registry: FileRegistry,
) -> list[dict]:
    """Run the full processing pipeline and return a list of output row dicts."""
    alias_index = build_alias_index(brain.field_aliases)

    source_dfs: dict[str, pd.DataFrame] = {}
    for key in registry.keys():
        try:
            raw_df = registry.get(key).get_dataframe()
            source_dfs[key] = get_canonical_df(raw_df, key, alias_index)
        except MissingSourceColumnError as exc:
            raise exc
        except Exception as exc:
            log.warning("Could not load source '%s': %s", key, exc)

    denial_source = source_dfs.pop("denial_records", None)
    if denial_source is None:
        raise RuntimeError("denial_records could not be loaded.")

    reason_mapper = ReasonCodeMapper(brain)

    output_rows: list[dict] = []
    for _, row in denial_source.iterrows():
        denial_row = row.to_dict()
        try:
            out = _process_row(denial_row, brain, reason_mapper, alias_index, source_dfs)
        except Exception as exc:
            log.exception("Unexpected error processing row %s: %s", denial_row.get("Denial_ID"), exc)
            out = {
                "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
                "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
                "Reason_Code": _safe_str(denial_row.get("Reason_Code")),
                "Primary_Source_Checked": "",
                "Research_Finding": f"Internal processing error: {exc}",
                "Recommended_Next_Action": "Manual review required.",
                "Agent_Status": "Needs Manual Review",
            }
        output_rows.append(out)

    return output_rows
