"""Parse the Claims_AI_Rules_Brain.xlsx workbook into a RulesBrain config object.

Actual sheet structure (all sheets use a 2-row header: row 1 = description
title, row 2 = actual column headers):

  Field_Dictionary     – canonical fields, sources, and accepted aliases
  Scenarios            – scenario routing metadata
  Join_Logic           – per-scenario join keys and strategy
  Validation_Checks    – per-field validation rules
  Reason_Code_Aliases  – canonical reason codes and accepted aliases
  Output_Template      – output column names and order
  Status_Color_Rules   – (informational, not parsed)
  Agent_Guardrails     – (informational, not parsed)

Required sheets (HTTP 400 if absent): Field_Dictionary, Scenarios
Optional sheets: Join_Logic, Validation_Checks, Reason_Code_Aliases,
                 Output_Template, Output_Defaults
"""

from __future__ import annotations

import io
from typing import Any, Optional

import pandas as pd

from .errors import MissingRulesBrainSheetError
from .schemas import (
    FieldAlias,
    OutputDefaults,
    RulesBrain,
    ScenarioConfig,
    ValidationRule,
)

# ---------------------------------------------------------------------------
# Default output column order — overridden by Output_Template sheet
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

REQUIRED_SHEETS = {"Field_Dictionary", "Scenarios"}

# Map rules brain source names → registry keys used by the pipeline
_SOURCE_KEY: dict[str, str] = {
    "denialrecords": "denial_records",
    "contractsdata": "contracts_data",
    "customermasterrecords": "customer_master",
    "materialmasterrecords": "material_master",
    "pricingdata": "pricing_data",
}


def _to_registry_key(name: str) -> str:
    """Convert a rules brain source name to its pipeline registry key."""
    slug = name.strip().lower().replace(" ", "").replace("_", "")
    return _SOURCE_KEY.get(slug, name.strip().lower().replace(" ", "_"))


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------


def _str(val: Any) -> str:
    if val is None:
        return ""
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    return str(val).strip()


def _split_semi(val: Any) -> list[str]:
    """Split a semicolon-delimited cell into a list of stripped non-empty parts."""
    return [s.strip() for s in _str(val).split(";") if s.strip()]


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase + strip all column names."""
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _try_skip_description_row(df: pd.DataFrame) -> pd.DataFrame:
    """Handle the multi-row description header pattern in the rules brain.

    Sheets can have 1–2 description rows above the actual column headers,
    which pandas reads as the sheet column name plus early data rows.
    This function repeatedly promotes the first data row as the header until
    the column names look like real field names (short, no 'Unnamed: N', no
    NaN-string, no long sentence fragments).
    """
    for _ in range(4):  # safety cap — no sheet should need more than 3 promotions
        if df.empty:
            break
        bad_count = sum(
            1
            for c in df.columns
            if "unnamed" in str(c).lower()
            or str(c).strip().lower() == "nan"
            or len(str(c).strip()) > 60
        )
        if bad_count <= len(df.columns) // 2:
            break
        new_headers = [str(v).strip().lower() for v in df.iloc[0]]
        df = df.iloc[1:].reset_index(drop=True)
        df.columns = new_headers
    return df


def _load_all_sheets(file_bytes: bytes | io.IOBase) -> dict[str, pd.DataFrame]:
    if isinstance(file_bytes, (bytes, bytearray)):
        buf = io.BytesIO(file_bytes)
    else:
        buf = file_bytes
    return pd.read_excel(buf, sheet_name=None, dtype=str)


def _sheet_lookup(sheets: dict[str, pd.DataFrame]) -> dict[str, str]:
    """Case-insensitive name → actual sheet name mapping."""
    return {k.strip().lower(): k for k in sheets}


def _get_sheet(
    sheets: dict,
    lookup: dict,
    name: str,
    required: bool = False,
) -> Optional[pd.DataFrame]:
    actual = lookup.get(name.lower())
    if actual is None:
        if required:
            raise MissingRulesBrainSheetError(name)
        return None
    df = sheets[actual].copy()
    df = _normalise_columns(df)
    df = _try_skip_description_row(df)
    return df


def _find_col(df: pd.DataFrame, *keywords: str) -> Optional[str]:
    """Return the first column whose name contains ALL of the given keywords."""
    for col in df.columns:
        if all(kw in col for kw in keywords):
            return col
    return None


# ---------------------------------------------------------------------------
# Section parsers
# ---------------------------------------------------------------------------


def _parse_field_dictionary(df: pd.DataFrame) -> list[FieldAlias]:
    """Parse Field_Dictionary sheet.

    Expected columns: canonical_field | applies_to_source | accepted_aliases
    Expands semicolon-separated sources and aliases into individual FieldAlias
    objects (one per canonical+source+alias combination).
    """
    col_canonical = _find_col(df, "canonical")
    col_sources = _find_col(df, "applies") or _find_col(df, "source")
    col_aliases = _find_col(df, "alias") or _find_col(df, "accepted")

    if not col_canonical or not col_sources or not col_aliases:
        raise MissingRulesBrainSheetError(
            "Field_Dictionary sheet is missing required columns "
            "(expected: Canonical_Field, Applies_To_Source, Accepted_Aliases)"
        )

    aliases: list[FieldAlias] = []
    for _, row in df.iterrows():
        canonical = _str(row[col_canonical])
        if not canonical or canonical.lower() in ("canonical_field", "nan"):
            continue
        sources = _split_semi(row[col_sources])
        raw_names = _split_semi(row[col_aliases])
        for source_raw in sources:
            source_key = _to_registry_key(source_raw)
            for raw in raw_names:
                aliases.append(
                    FieldAlias(
                        canonical_name=canonical,
                        source=source_key,
                        raw_name=raw,
                    )
                )
    return aliases


def _parse_join_logic(df: Optional[pd.DataFrame]) -> dict[str, dict]:
    """Parse Join_Logic sheet into a dict keyed by Reason_Code.

    Returns:
        {reason_code: {"join_keys": [...], "secondary_join_keys": [...],
                       "duplicate_match_strategy": "manual_review"|"first"}}
    """
    if df is None:
        return {}

    col_code = _find_col(df, "reason") or _find_col(df, "code")
    col_driver_keys = _find_col(df, "driver", "key")
    col_join_mode = _find_col(df, "join_mode") or _find_col(df, "mode")
    col_dup = _find_col(df, "duplicate")

    if not col_code:
        return {}

    result: dict[str, dict] = {}
    for _, row in df.iterrows():
        code = _str(row[col_code])
        if not code or code.lower() in ("reason_code", "nan"):
            continue

        driver_keys = _split_semi(row[col_driver_keys]) if col_driver_keys else []
        join_mode = _str(row[col_join_mode]).lower() if col_join_mode else "all_keys_match"
        dup_raw = _str(row[col_dup]).lower() if col_dup else ""

        # Map duplicate strategy to internal values
        dup_strategy = "first" if "first" in dup_raw else "manual_review"

        # any_key_match: try each key independently as primary → fallback chain
        # all_keys_match: all keys required simultaneously in a single join
        if join_mode == "any_key_match" and len(driver_keys) > 1:
            join_keys = [driver_keys[0]]
            secondary_keys = driver_keys[1:]
        else:
            join_keys = driver_keys
            secondary_keys = []

        result[code] = {
            "join_keys": join_keys,
            "secondary_join_keys": secondary_keys,
            "duplicate_match_strategy": dup_strategy,
        }
    return result


def _parse_scenarios(
    df: pd.DataFrame,
    join_logic: dict[str, dict],
) -> dict[str, ScenarioConfig]:
    """Parse Scenarios sheet, merging in join keys from join_logic."""
    col_code = _find_col(df, "reason")
    col_source = _find_col(df, "primary", "source")
    col_display = _find_col(df, "checked", "output")
    col_no_match = _find_col(df, "missing", "status")
    col_enabled = _find_col(df, "enabled")
    col_rec_action = _find_col(df, "recommended") or _find_col(df, "default", "action")

    if not col_code or not col_source:
        raise MissingRulesBrainSheetError(
            "Scenarios sheet is missing required columns "
            "(expected: Reason_Code, Primary_Source_File)"
        )

    scenarios: dict[str, ScenarioConfig] = {}
    for _, row in df.iterrows():
        code = _str(row[col_code])
        if not code or code.lower() in ("reason_code", "nan"):
            continue

        # Skip disabled scenarios
        if col_enabled:
            enabled_val = _str(row.get(col_enabled, "Yes")).lower()
            if enabled_val and enabled_val not in ("yes", "true", "1"):
                continue

        source_raw = _str(row[col_source])
        primary_source = _to_registry_key(source_raw)

        display_name = ""
        if col_display:
            display_name = _str(row.get(col_display, ""))

        no_match_status = "Data Missing"
        if col_no_match:
            no_match_status = _str(row.get(col_no_match, "")) or "Data Missing"

        default_action = ""
        if col_rec_action:
            default_action = _str(row.get(col_rec_action, ""))

        jl = join_logic.get(code, {})
        join_keys = jl.get("join_keys", [])
        secondary_keys = jl.get("secondary_join_keys", [])
        dup_strategy = jl.get("duplicate_match_strategy", "manual_review")

        scenarios[code] = ScenarioConfig(
            scenario_name=code,
            primary_source=primary_source,
            join_keys=join_keys,
            secondary_join_keys=secondary_keys,
            duplicate_match_strategy=dup_strategy,
            default_agent_status_no_match=no_match_status,
            default_recommended_next_action=default_action,
            primary_source_display=display_name,
        )
    return scenarios


def _strip_source_prefix(val: str) -> str:
    """Normalise source-prefixed field references.

    DenialRecords.X  →  denial_X   (preserved under explicit denial prefix)
    OtherSource.X    →  X          (source fields win in the merged record)
    """
    if "." not in val:
        return val
    source, field = val.split(".", 1)
    if source.strip().lower() == "denialrecords":
        return f"denial_{field}"
    return field


def _parse_validation_checks(
    df: Optional[pd.DataFrame],
    scenarios: dict[str, ScenarioConfig],
) -> dict[str, list[ValidationRule]]:
    """Parse Validation_Checks sheet.

    Expected columns: Reason_Code | Field_or_Field_Group | Operator |
                      Expected_Value_or_Reference | Source | Finding_Note

    Generates ValidationRule objects with defaults for missing pass/fail text.
    Compound fields (semicolon-separated) in an exists/is_not_blank check are
    expanded into one rule per field.
    """
    if df is None:
        return {}

    col_code = _find_col(df, "reason", "code") or _find_col(df, "reason")
    col_field = _find_col(df, "field", "group") or _find_col(df, "field")
    col_op = _find_col(df, "operator")
    col_right = _find_col(df, "expected") or _find_col(df, "value") or _find_col(df, "reference")
    col_finding = _find_col(df, "finding") or _find_col(df, "note")

    if not col_code or not col_field or not col_op:
        return {}

    rules: dict[str, list[ValidationRule]] = {}
    rule_counters: dict[str, int] = {}

    for _, row in df.iterrows():
        code = _str(row[col_code])
        if not code or code.lower() in ("reason_code", "nan"):
            continue

        field_raw = _str(row[col_field]) if col_field else ""
        op = _str(row[col_op]).lower() if col_op else ""
        right_raw = _str(row[col_right]) if col_right else ""
        finding_note = _str(row[col_finding]) if col_finding else ""

        if not op or op == "operator":
            continue

        # Strip source prefix from right-hand references
        right_val: Optional[str] = _strip_source_prefix(right_raw) if right_raw else None

        # Normalise semicolon separator → comma for between_dates variants
        if op in ("between_dates", "between_dates_if_present") and right_val:
            right_val = right_val.replace(";", ",")

        # Expand compound fields (e.g. "Customer_ID;Material_ID") for exists checks
        individual_fields = _split_semi(field_raw) if ";" in field_raw else [field_raw]

        for field in individual_fields:
            if not field:
                continue

            # For multi-field rows, only existence-type operators make sense per-field
            if len(individual_fields) > 1 and op not in (
                "exists", "not_exists", "is_blank", "is_not_blank",
            ):
                continue

            rule_counters[code] = rule_counters.get(code, 0) + 1
            rule_id = f"{code}_R{rule_counters[code]:03d}"

            scenario = scenarios.get(code)
            fail_action = (
                scenario.default_recommended_next_action
                if scenario and scenario.default_recommended_next_action
                else "Manual review required."
            )

            vr = ValidationRule(
                scenario_name=code,
                rule_id=rule_id,
                left_field=field,
                operator=op,
                right_field_or_value=right_val or None,
                tolerance=None,
                research_finding_pass="",
                research_finding_fail=finding_note,
                recommended_action_pass="",
                recommended_action_fail=fail_action,
            )
            rules.setdefault(code, []).append(vr)

    return rules


def _parse_reason_code_aliases(df: Optional[pd.DataFrame]) -> dict[str, str]:
    """Parse Reason_Code_Aliases sheet.

    Expected columns: Canonical_Reason_Code | Accepted_Aliases
    Semicolon-separated aliases are expanded to one mapping entry each.
    """
    if df is None:
        return {}

    col_canonical = _find_col(df, "canonical")
    col_aliases = _find_col(df, "alias") or _find_col(df, "accepted")

    if not col_canonical or not col_aliases:
        return {}

    mapping: dict[str, str] = {}
    for _, row in df.iterrows():
        canonical = _str(row[col_canonical])
        if not canonical or canonical.lower() in ("canonical_reason_code", "nan"):
            continue
        for alias in _split_semi(row[col_aliases]):
            mapping[alias] = canonical
    return mapping


def _parse_output_defaults(df: Optional[pd.DataFrame]) -> OutputDefaults:
    """Two-column key|value table (legacy sheet — optional)."""
    if df is None:
        return OutputDefaults()
    key_col = _find_col(df, "key")
    val_col = _find_col(df, "value")
    if not key_col or not val_col:
        return OutputDefaults()
    kv = {
        _str(r[key_col]).lower(): _str(r[val_col])
        for _, r in df.iterrows()
        if _str(r[key_col])
    }
    return OutputDefaults(
        ecc_update_type=kv.get("ecc_update_type", "Research Finding Only"),
        financial_posting_allowed=kv.get("financial_posting_allowed", "No"),
        pricing_change_allowed=kv.get("pricing_change_allowed", "No"),
    )


def _parse_output_template(df: Optional[pd.DataFrame]) -> list[str]:
    if df is None:
        return DEFAULT_OUTPUT_COLUMNS[:]
    # Find the column whose name contains "column" but not "style"
    col_col = next(
        (c for c in df.columns if "column" in c and "style" not in c),
        None,
    )
    if col_col is None:
        return DEFAULT_OUTPUT_COLUMNS[:]
    # Skip header-looking values (contain spaces) and known non-data sentinels
    cols = [
        _str(v)
        for v in df[col_col]
        if _str(v) and " " not in _str(v) and _str(v).lower() not in ("column_name", "nan")
    ]
    return cols if cols else DEFAULT_OUTPUT_COLUMNS[:]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def load_rules_brain(file_bytes: bytes | io.IOBase) -> RulesBrain:
    """Parse the rules brain workbook and return a validated RulesBrain config."""
    sheets = _load_all_sheets(file_bytes)
    lookup = _sheet_lookup(sheets)

    # Required sheets
    fd_df = _get_sheet(sheets, lookup, "Field_Dictionary", required=True)
    sc_df = _get_sheet(sheets, lookup, "Scenarios", required=True)

    field_aliases = _parse_field_dictionary(fd_df)

    # Join_Logic supplements Scenarios with join keys
    jl_df = _get_sheet(sheets, lookup, "Join_Logic")
    join_logic = _parse_join_logic(jl_df)

    scenarios = _parse_scenarios(sc_df, join_logic)

    # Optional sheets
    vc_df = _get_sheet(sheets, lookup, "Validation_Checks")
    validation_rules = _parse_validation_checks(vc_df, scenarios) if vc_df is not None else {}

    rc_df = _get_sheet(sheets, lookup, "Reason_Code_Aliases")
    reason_code_map = _parse_reason_code_aliases(rc_df) if rc_df is not None else {}

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
