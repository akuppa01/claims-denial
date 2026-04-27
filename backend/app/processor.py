"""Core processing pipeline.

Orchestrates the end-to-end flow for each denial record:
  1. Resolve canonical reason code
  2. Look up scenario config
  3. Apply field aliases to source DataFrames
  4. Execute the appropriate join
  5. Run validation rules
  6. Build the output row dict

All decisions are driven by the RulesBrain config; no hardcoded business
rules live here beyond the safety guardrails mandated in the spec.
"""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from .errors import MissingSourceColumnError
from .field_mapper import build_alias_index, get_canonical_df
from .file_registry import FileRegistry
from .join_engine import JoinResult, join_denial_to_source, join_with_fallback_keys
from .reason_code_mapper import ReasonCodeMapper
from .schemas import RulesBrain, ScenarioConfig
from .validation_engine import evaluate_scenario_rules

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Canonical field names expected on the denial records source
# ---------------------------------------------------------------------------
DENIAL_REQUIRED_COLS = ["Claim_ID", "Denial_ID", "Reason_Code"]

# ---------------------------------------------------------------------------
# Scenario-specific source keys (overrides the rules brain primary_source for
# scenarios that require a specific source regardless of rules brain value)
# We still read primary_source from the rules brain — this is just the fallback
# key used when the rules brain primary_source is not in the registry.
# ---------------------------------------------------------------------------


def _safe_str(val: Any) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    return str(val).strip()


def _unknown_code_row(denial_row: dict, raw_code: str, defaults) -> dict:
    return {
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


def _ambiguous_code_row(denial_row: dict, raw_code: str, defaults) -> dict:
    return {
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


def _data_missing_row(denial_row: dict, canonical_code: str, scenario: ScenarioConfig, defaults) -> dict:
    return {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": canonical_code,
        "Primary_Source_Checked": scenario.primary_source.replace("_", " ").title(),
        "Research_Finding": "No matching source record found.",
        "Recommended_Next_Action": "Verify source data availability and correct record identifiers.",
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": scenario.default_agent_status_no_match,
    }


def _duplicate_match_row(denial_row: dict, canonical_code: str, scenario: ScenarioConfig, defaults, count: int) -> dict:
    return {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": canonical_code,
        "Primary_Source_Checked": scenario.primary_source.replace("_", " ").title(),
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


def _missing_contract_row(denial_row: dict, defaults) -> dict:
    return {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": "MISSING_CONTRACT",
        "Primary_Source_Checked": "Contract Data",
        "Research_Finding": "No matching contract found.",
        "Recommended_Next_Action": (
            "Research contract coverage and confirm correct contract assignment."
        ),
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": "Data Missing",
    }


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
            return _missing_contract_row(denial_row, defaults)
        # Contract was actually found — report accordingly
        out_row = {
            "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
            "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
            "Reason_Code": canonical,
            "Primary_Source_Checked": "Contract Data",
            "Research_Finding": "Matching contract was found in Contract Data.",
            "Recommended_Next_Action": "Review contract assignment and validate claim.",
            "Agent_Status": "Needs Manual Review",
        }
        return out_row

    # ------------------------------------------------------------------
    # All other scenarios: join then validate
    # ------------------------------------------------------------------
    source_df = source_dfs.get(scenario.primary_source)
    if source_df is None:
        out = _data_missing_row(denial_row, canonical, scenario, defaults)
        out["Research_Finding"] = f"Source '{scenario.primary_source}' is not available."
        return out

    # Join (with fallback keys if configured)
    join_result = join_with_fallback_keys(denial_row, source_df, scenario)

    if join_result.status == "no_match":
        return _data_missing_row(denial_row, canonical, scenario, defaults)

    if join_result.status == "duplicate":
        return _duplicate_match_row(denial_row, canonical, scenario, defaults, len(join_result.rows))

    # Merge denial row + matched source row for validation
    merged = {**join_result.matched_row, **denial_row}

    rules = brain.validation_rules.get(canonical, [])
    v_result = evaluate_scenario_rules(rules, merged)

    return {
        "Claim_ID": _safe_str(denial_row.get("Claim_ID")),
        "Denial_ID": _safe_str(denial_row.get("Denial_ID")),
        "Reason_Code": canonical,
        "Primary_Source_Checked": scenario.primary_source.replace("_", " ").title(),
        "Research_Finding": v_result.research_finding,
        "Recommended_Next_Action": v_result.recommended_next_action,
        "ECC_Update_Type": defaults.ecc_update_type,
        "Financial_Posting_Allowed": defaults.financial_posting_allowed,
        "Pricing_Change_Allowed": defaults.pricing_change_allowed,
        "Agent_Status": v_result.agent_status,
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def process_claims(
    brain: RulesBrain,
    registry: FileRegistry,
) -> list[dict]:
    """Run the full processing pipeline and return a list of output row dicts."""
    alias_index = build_alias_index(brain.field_aliases)

    # Load and alias-map all source DataFrames once (cached in registry)
    source_dfs: dict[str, pd.DataFrame] = {}
    for key in registry.keys():
        try:
            raw_df = registry.get(key).get_dataframe()
            source_dfs[key] = get_canonical_df(raw_df, key, alias_index)
        except MissingSourceColumnError as exc:
            raise exc  # propagate — these are fatal
        except Exception as exc:
            log.warning("Could not load source '%s': %s", key, exc)

    # Load and alias-map denial records
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
