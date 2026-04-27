"""Parse the Claims_AI_Rules_Brain.xlsx workbook into a RulesBrain config object.

Expected sheets (case-insensitive column headers):
  Field_Aliases      – canonical_name | source | raw_name
  Scenarios          – scenario_name | primary_source | join_keys |
                       secondary_join_keys | duplicate_match_strategy |
                       default_agent_status_no_match
  Validation_Rules   – scenario_name | rule_id | left_field | operator |
                       right_field_or_value | tolerance |
                       research_finding_pass | research_finding_fail |
                       recommended_action_pass | recommended_action_fail
  Reason_Code_Map    – canonical_code | variant
  Output_Defaults    – key | value          (two-column vertical table)
  Output_Template    – column_name          (ordered list of output columns)

All sheets are optional (the backend falls back to safe defaults) except
Field_Aliases and Scenarios, which are required.
"""

from __future__ import annotations

import io
from typing import Any

from typing import Optional

import pandas as pd

from .errors import MissingRulesBrainSheetError
from .schemas import (
    FieldAlias,
    OutputDefaults,
    ReasonCodeEntry,
    RulesBrain,
    ScenarioConfig,
    ValidationRule,
)

# ---------------------------------------------------------------------------
# Default output column order (mirrors the spec; overridden by Output_Template)
# ---------------------------------------------------------------------------
DEFAULT_OUTPUT_COLUMNS = [
    "Claim_ID",
    "Denial_ID",
    "Reason_Code",
    "Primary_Source_Checked",
    "Research_Finding",
    "Recommended_Next_Action",
    "ECC_Update_Type",
    "Financial_Posting_Allowed",
    "Pricing_Change_Allowed",
    "Agent_Status",
    "Processed_Timestamp",
]

REQUIRED_SHEETS = {"Field_Aliases", "Scenarios"}


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase + strip all column names for case-insensitive matching."""
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _str(val: Any) -> str:
    if pd.isna(val):
        return ""
    return str(val).strip()


def _load_all_sheets(file_bytes: bytes | io.IOBase) -> dict[str, pd.DataFrame]:
    if isinstance(file_bytes, (bytes, bytearray)):
        buf = io.BytesIO(file_bytes)
    else:
        buf = file_bytes
    return pd.read_excel(buf, sheet_name=None, dtype=str)


def _sheet_lookup(sheets: dict[str, pd.DataFrame]) -> dict[str, str]:
    """Return a case-insensitive name → actual name mapping."""
    return {k.strip().lower(): k for k in sheets}


def _get_sheet(
    sheets: dict,
    lookup: dict,
    name: str,
    required: bool = False,
) -> "Optional[pd.DataFrame]":
    actual = lookup.get(name.lower())
    if actual is None:
        if required:
            raise MissingRulesBrainSheetError(name)
        return None
    return _normalise_columns(sheets[actual].copy())


# ---------------------------------------------------------------------------
# Section parsers
# ---------------------------------------------------------------------------


def _parse_field_aliases(df: pd.DataFrame) -> list[FieldAlias]:
    required = {"canonical_name", "source", "raw_name"}
    missing = required - set(df.columns)
    if missing:
        raise MissingRulesBrainSheetError(
            f"Field_Aliases sheet missing columns: {missing}"
        )
    aliases: list[FieldAlias] = []
    for _, row in df.iterrows():
        canonical = _str(row["canonical_name"])
        source = _str(row["source"])
        raw = _str(row["raw_name"])
        if canonical and source and raw:
            aliases.append(FieldAlias(canonical_name=canonical, source=source, raw_name=raw))
    return aliases


def _parse_scenarios(df: pd.DataFrame) -> dict[str, ScenarioConfig]:
    required = {"scenario_name", "primary_source", "join_keys"}
    missing = required - set(df.columns)
    if missing:
        raise MissingRulesBrainSheetError(
            f"Scenarios sheet missing columns: {missing}"
        )
    scenarios: dict[str, ScenarioConfig] = {}
    for _, row in df.iterrows():
        name = _str(row["scenario_name"])
        if not name:
            continue
        join_keys = [k.strip() for k in _str(row["join_keys"]).split(",") if k.strip()]
        secondary = []
        if "secondary_join_keys" in df.columns:
            secondary = [
                k.strip()
                for k in _str(row.get("secondary_join_keys", "")).split(",")
                if k.strip()
            ]
        dup_strategy = "manual_review"
        if "duplicate_match_strategy" in df.columns:
            dup_strategy = _str(row.get("duplicate_match_strategy", "")) or "manual_review"
        no_match_status = "Data Missing"
        if "default_agent_status_no_match" in df.columns:
            no_match_status = _str(row.get("default_agent_status_no_match", "")) or "Data Missing"
        scenarios[name] = ScenarioConfig(
            scenario_name=name,
            primary_source=_str(row["primary_source"]),
            join_keys=join_keys,
            secondary_join_keys=secondary,
            duplicate_match_strategy=dup_strategy,
            default_agent_status_no_match=no_match_status,
        )
    return scenarios


def _parse_validation_rules(df: pd.DataFrame) -> dict[str, list[ValidationRule]]:
    required = {"scenario_name", "rule_id", "left_field", "operator"}
    missing = required - set(df.columns)
    if missing:
        return {}  # optional — silently skip
    rules: dict[str, list[ValidationRule]] = {}
    for _, row in df.iterrows():
        scenario = _str(row["scenario_name"])
        if not scenario:
            continue
        tol_raw = _str(row.get("tolerance", ""))
        tol = None
        if tol_raw:
            try:
                tol = float(tol_raw)
            except ValueError:
                tol = None
        right = None
        if "right_field_or_value" in df.columns:
            right = _str(row["right_field_or_value"]) or None
        vr = ValidationRule(
            scenario_name=scenario,
            rule_id=_str(row["rule_id"]),
            left_field=_str(row["left_field"]),
            operator=_str(row["operator"]).lower(),
            right_field_or_value=right,
            tolerance=tol,
            research_finding_pass=_str(row.get("research_finding_pass", "")),
            research_finding_fail=_str(row.get("research_finding_fail", "")),
            recommended_action_pass=_str(row.get("recommended_action_pass", "")),
            recommended_action_fail=_str(row.get("recommended_action_fail", "")),
        )
        rules.setdefault(scenario, []).append(vr)
    return rules


def _parse_reason_code_map(df: pd.DataFrame) -> dict[str, str]:
    required = {"canonical_code", "variant"}
    missing = required - set(df.columns)
    if missing:
        return {}
    mapping: dict[str, str] = {}
    for _, row in df.iterrows():
        canonical = _str(row["canonical_code"])
        variant = _str(row["variant"])
        if canonical and variant:
            mapping[variant] = canonical
    return mapping


def _parse_output_defaults(df: pd.DataFrame) -> OutputDefaults:
    """Vertical two-column table: key | value."""
    if "key" not in df.columns or "value" not in df.columns:
        return OutputDefaults()
    kv = {_str(r["key"]).lower(): _str(r["value"]) for _, r in df.iterrows() if _str(r["key"])}
    return OutputDefaults(
        ecc_update_type=kv.get("ecc_update_type", "Research Finding Only"),
        financial_posting_allowed=kv.get("financial_posting_allowed", "No"),
        pricing_change_allowed=kv.get("pricing_change_allowed", "No"),
    )


def _parse_output_template(df: pd.DataFrame) -> list[str]:
    col_col = next((c for c in df.columns if "column" in c), None)
    if col_col is None:
        return DEFAULT_OUTPUT_COLUMNS[:]
    cols = [_str(v) for v in df[col_col] if _str(v)]
    return cols if cols else DEFAULT_OUTPUT_COLUMNS[:]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def load_rules_brain(file_bytes: bytes | io.IOBase) -> RulesBrain:
    """Parse the rules brain workbook and return a validated RulesBrain config."""
    sheets = _load_all_sheets(file_bytes)
    lookup = _sheet_lookup(sheets)

    # Required sheets
    fa_df = _get_sheet(sheets, lookup, "Field_Aliases", required=True)
    sc_df = _get_sheet(sheets, lookup, "Scenarios", required=True)

    field_aliases = _parse_field_aliases(fa_df)
    scenarios = _parse_scenarios(sc_df)

    # Optional sheets
    vr_df = _get_sheet(sheets, lookup, "Validation_Rules")
    validation_rules = _parse_validation_rules(vr_df) if vr_df is not None else {}

    rc_df = _get_sheet(sheets, lookup, "Reason_Code_Map")
    reason_code_map = _parse_reason_code_map(rc_df) if rc_df is not None else {}

    od_df = _get_sheet(sheets, lookup, "Output_Defaults")
    output_defaults = _parse_output_defaults(od_df) if od_df is not None else OutputDefaults()

    ot_df = _get_sheet(sheets, lookup, "Output_Template")
    output_columns = _parse_output_template(ot_df) if ot_df is not None else DEFAULT_OUTPUT_COLUMNS[:]

    return RulesBrain(
        field_aliases=field_aliases,
        scenarios=scenarios,
        validation_rules=validation_rules,
        reason_code_map=reason_code_map,
        output_defaults=output_defaults,
        output_columns=output_columns,
        raw_sheets={k: sheets[k] for k in sheets},
    )
