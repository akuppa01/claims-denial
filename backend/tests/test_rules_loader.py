"""Tests for rules_loader.py — parsing the rules brain workbook.

The actual rules brain uses a 2-row header format on every sheet:
  row 1: description title (causes most columns to appear as "Unnamed: N")
  row 2: actual column headers
  row 3+: data

Test workbooks mirror this format.  Required sheets: Field_Dictionary,
Scenarios.  Optional: Join_Logic, Validation_Checks, Reason_Code_Aliases,
Output_Template, Output_Defaults.
"""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.errors import MissingRulesBrainSheetError
from app.rules_loader import DEFAULT_OUTPUT_COLUMNS, load_rules_brain


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_workbook(sheets: dict[str, pd.DataFrame]) -> bytes:
    """Write a dict of DataFrames to an in-memory Excel workbook."""
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    buf.seek(0)
    return buf.read()


def _with_description_row(df: pd.DataFrame, title: str = "Description") -> pd.DataFrame:
    """Prepend a description row above the column headers so the DataFrame
    mirrors the 2-row header format used in the real rules brain.

    The resulting Excel sheet will have:
      row 1: title | (NaN, NaN, ...)
      row 2: actual column headers
      row 3+: data
    """
    header_row = pd.DataFrame([[title] + [""] * (len(df.columns) - 1)], columns=df.columns)
    return pd.concat([header_row, df], ignore_index=True)


def _minimal_field_dictionary() -> pd.DataFrame:
    data = pd.DataFrame(
        [
            {
                "Canonical_Field": "Claim_ID",
                "Applies_To_Source": "DenialRecords",
                "Accepted_Aliases": "Claim_ID;Claim ID",
                "Data_Type": "string",
                "Required": "Yes",
                "Notes": "",
            },
            {
                "Canonical_Field": "Denial_ID",
                "Applies_To_Source": "DenialRecords",
                "Accepted_Aliases": "Denial_ID;Denial ID",
                "Data_Type": "string",
                "Required": "Yes",
                "Notes": "",
            },
            {
                "Canonical_Field": "Reason_Code",
                "Applies_To_Source": "DenialRecords",
                "Accepted_Aliases": "Reason_Code;Reason Code",
                "Data_Type": "string",
                "Required": "Yes",
                "Notes": "",
            },
            {
                "Canonical_Field": "Material_ID",
                "Applies_To_Source": "DenialRecords;MaterialMasterRecords",
                "Accepted_Aliases": "Material_ID;Material ID",
                "Data_Type": "string",
                "Required": "No",
                "Notes": "",
            },
        ]
    )
    return _with_description_row(data, "Field Dictionary & Aliases")


def _minimal_scenarios() -> pd.DataFrame:
    data = pd.DataFrame(
        [
            {
                "Reason_Code": "MAT_ATTR_MISMATCH",
                "Scenario_Name": "Material attribute mismatch",
                "Primary_Source_File": "MaterialMasterRecords",
                "Secondary_Source_File": "",
                "Primary_Source_Checked_Output": "Material Master",
                "Default_Recommended_Next_Action": "Validate material attributes.",
                "Success_Status": "Ready for Resubmission Review",
                "Missing_Data_Status": "Data Missing",
                "Duplicate_Match_Status": "Needs Manual Review",
                "Unknown_or_Ambiguous_Status": "Needs Manual Review",
                "Enabled": "Yes",
            }
        ]
    )
    return _with_description_row(data, "Scenario Routing")


def _minimal_join_logic() -> pd.DataFrame:
    data = pd.DataFrame(
        [
            {
                "Reason_Code": "MAT_ATTR_MISMATCH",
                "Driver_Source": "DenialRecords",
                "Lookup_Source": "MaterialMasterRecords",
                "Driver_Join_Keys": "Material_ID;NDC",
                "Lookup_Join_Keys": "Material_ID;NDC",
                "Join_Mode": "any_key_match",
                "Duplicate_Match_Strategy": "single_or_missing",
                "Notes": "",
            }
        ]
    )
    return _with_description_row(data, "Join Logic")


def _minimal_sheets() -> dict[str, pd.DataFrame]:
    return {
        "Field_Dictionary": _minimal_field_dictionary(),
        "Scenarios": _minimal_scenarios(),
        "Join_Logic": _minimal_join_logic(),
    }


# ---------------------------------------------------------------------------
# Tests: required sheet presence
# ---------------------------------------------------------------------------


class TestRequiredSheets:
    def test_parses_minimal_valid_workbook(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        assert "MAT_ATTR_MISMATCH" in brain.scenarios
        assert len(brain.field_aliases) >= 4

    def test_raises_on_missing_field_dictionary(self):
        sheets = _minimal_sheets()
        del sheets["Field_Dictionary"]
        with pytest.raises(MissingRulesBrainSheetError):
            load_rules_brain(_make_workbook(sheets))

    def test_raises_on_missing_scenarios(self):
        sheets = _minimal_sheets()
        del sheets["Scenarios"]
        with pytest.raises(MissingRulesBrainSheetError):
            load_rules_brain(_make_workbook(sheets))


# ---------------------------------------------------------------------------
# Tests: Field_Dictionary parsing
# ---------------------------------------------------------------------------


class TestFieldDictionaryParsing:
    def test_field_aliases_generated(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        # Material_ID applies to two sources → multiple FieldAlias objects
        mat_aliases = [fa for fa in brain.field_aliases if fa.canonical_name == "Material_ID"]
        assert len(mat_aliases) >= 2  # denial_records + material_master

    def test_source_name_mapped_to_registry_key(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        sources = {fa.source for fa in brain.field_aliases}
        # "DenialRecords" should have been mapped to "denial_records"
        assert "denial_records" in sources
        assert "DenialRecords" not in sources

    def test_semicolon_separated_aliases_expanded(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        claim_aliases = [
            fa.raw_name
            for fa in brain.field_aliases
            if fa.canonical_name == "Claim_ID" and fa.source == "denial_records"
        ]
        # "Claim_ID;Claim ID" → both variants present
        assert "Claim_ID" in claim_aliases
        assert "Claim ID" in claim_aliases


# ---------------------------------------------------------------------------
# Tests: Scenarios + Join_Logic parsing
# ---------------------------------------------------------------------------


class TestScenariosParsing:
    def test_scenario_loaded(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        assert sc.primary_source == "material_master"

    def test_join_keys_from_join_logic_any_key_match(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        # any_key_match with Material_ID;NDC → primary=[Material_ID], secondary=[NDC]
        assert sc.join_keys == ["Material_ID"]
        assert sc.secondary_join_keys == ["NDC"]

    def test_join_keys_from_join_logic_all_keys_match(self):
        jl_data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Driver_Source": "DenialRecords",
                    "Lookup_Source": "MaterialMasterRecords",
                    "Driver_Join_Keys": "Contract_ID;Customer_ID;Material_ID",
                    "Lookup_Join_Keys": "Contract_ID;Customer_ID;Material_ID",
                    "Join_Mode": "all_keys_match",
                    "Duplicate_Match_Strategy": "single_or_missing",
                    "Notes": "",
                }
            ]
        )
        sheets = {
            "Field_Dictionary": _minimal_field_dictionary(),
            "Scenarios": _minimal_scenarios(),
            "Join_Logic": _with_description_row(jl_data, "Join Logic"),
        }
        brain = load_rules_brain(_make_workbook(sheets))
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        assert sc.join_keys == ["Contract_ID", "Customer_ID", "Material_ID"]
        assert sc.secondary_join_keys == []

    def test_missing_data_status_read_from_scenarios(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        assert sc.default_agent_status_no_match == "Data Missing"

    def test_default_recommended_action_read_from_scenarios(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        assert sc.default_recommended_next_action == "Validate material attributes."

    def test_disabled_scenario_excluded(self):
        sc_data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Scenario_Name": "Material attribute mismatch",
                    "Primary_Source_File": "MaterialMasterRecords",
                    "Secondary_Source_File": "",
                    "Primary_Source_Checked_Output": "Material Master",
                    "Default_Recommended_Next_Action": "",
                    "Success_Status": "Ready for Resubmission Review",
                    "Missing_Data_Status": "Data Missing",
                    "Duplicate_Match_Status": "Needs Manual Review",
                    "Unknown_or_Ambiguous_Status": "Needs Manual Review",
                    "Enabled": "No",
                }
            ]
        )
        sheets = {
            "Field_Dictionary": _minimal_field_dictionary(),
            "Scenarios": _with_description_row(sc_data, "Scenario Routing"),
        }
        brain = load_rules_brain(_make_workbook(sheets))
        assert "MAT_ATTR_MISMATCH" not in brain.scenarios

    def test_no_join_logic_sheet_gives_empty_keys(self):
        sheets = {
            "Field_Dictionary": _minimal_field_dictionary(),
            "Scenarios": _minimal_scenarios(),
        }
        brain = load_rules_brain(_make_workbook(sheets))
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        assert sc.join_keys == []
        assert sc.secondary_join_keys == []


# ---------------------------------------------------------------------------
# Tests: Validation_Checks parsing
# ---------------------------------------------------------------------------


class TestValidationChecksParsing:
    def _sheets_with_checks(self, checks_data: pd.DataFrame) -> dict[str, pd.DataFrame]:
        return {
            **_minimal_sheets(),
            "Validation_Checks": _with_description_row(checks_data, "Validation Checks"),
        }

    def test_simple_rule_parsed(self):
        data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "Material_Status",
                    "Operator": "equals",
                    "Expected_Value_or_Reference": "Active",
                    "Source": "MaterialMasterRecords",
                    "Finding_Note": "Mismatch if not Active.",
                }
            ]
        )
        brain = load_rules_brain(_make_workbook(self._sheets_with_checks(data)))
        assert "MAT_ATTR_MISMATCH" in brain.validation_rules
        rule = brain.validation_rules["MAT_ATTR_MISMATCH"][0]
        assert rule.left_field == "Material_Status"
        assert rule.operator == "equals"
        assert rule.right_field_or_value == "Active"
        assert "Mismatch" in rule.research_finding_fail

    def test_denial_records_prefix_mapped_to_denial_key(self):
        """DenialRecords.X should become denial_X so the merged record lookup works."""
        data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "Vendor_ID",
                    "Operator": "equals",
                    "Expected_Value_or_Reference": "DenialRecords.Vendor_ID",
                    "Source": "MaterialMasterRecords",
                    "Finding_Note": "Mismatch if vendor differs.",
                }
            ]
        )
        brain = load_rules_brain(_make_workbook(self._sheets_with_checks(data)))
        rule = brain.validation_rules["MAT_ATTR_MISMATCH"][0]
        # DenialRecords.Vendor_ID → denial_Vendor_ID (accessible in merged record)
        assert rule.right_field_or_value == "denial_Vendor_ID"

    def test_other_source_prefix_stripped(self):
        """MaterialMasterRecords.X (non-denial source) should just become X."""
        data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "NDC",
                    "Operator": "equals",
                    "Expected_Value_or_Reference": "MaterialMasterRecords.NDC",
                    "Source": "DenialRecords",
                    "Finding_Note": "Mismatch if NDC differs.",
                }
            ]
        )
        brain = load_rules_brain(_make_workbook(self._sheets_with_checks(data)))
        rule = brain.validation_rules["MAT_ATTR_MISMATCH"][0]
        assert rule.right_field_or_value == "NDC"

    def test_between_dates_semicolon_converted_to_comma(self):
        data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "Denial_Date",
                    "Operator": "between_dates",
                    "Expected_Value_or_Reference": "Contract_Start_Date;Contract_End_Date",
                    "Source": "ContractsData",
                    "Finding_Note": "Date out of range.",
                }
            ]
        )
        brain = load_rules_brain(_make_workbook(self._sheets_with_checks(data)))
        rule = brain.validation_rules["MAT_ATTR_MISMATCH"][0]
        assert rule.right_field_or_value == "Contract_Start_Date,Contract_End_Date"

    def test_compound_field_exists_expanded_to_individual_rules(self):
        data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "Customer_ID;Material_ID",
                    "Operator": "exists",
                    "Expected_Value_or_Reference": "",
                    "Source": "ContractsData",
                    "Finding_Note": "Missing field.",
                }
            ]
        )
        brain = load_rules_brain(_make_workbook(self._sheets_with_checks(data)))
        rules = brain.validation_rules["MAT_ATTR_MISMATCH"]
        # Each compound field becomes its own rule
        assert len(rules) == 2
        fields = {r.left_field for r in rules}
        assert fields == {"Customer_ID", "Material_ID"}

    def test_rule_ids_are_unique_per_scenario(self):
        data = pd.DataFrame(
            [
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "Material_ID",
                    "Operator": "exists",
                    "Expected_Value_or_Reference": "",
                    "Source": "MaterialMasterRecords",
                    "Finding_Note": "Missing material.",
                },
                {
                    "Reason_Code": "MAT_ATTR_MISMATCH",
                    "Field_or_Field_Group": "Vendor_ID",
                    "Operator": "equals",
                    "Expected_Value_or_Reference": "DenialRecords.Vendor_ID",
                    "Source": "MaterialMasterRecords",
                    "Finding_Note": "Vendor mismatch.",
                },
            ]
        )
        brain = load_rules_brain(_make_workbook(self._sheets_with_checks(data)))
        rules = brain.validation_rules["MAT_ATTR_MISMATCH"]
        ids = [r.rule_id for r in rules]
        assert len(ids) == len(set(ids))


# ---------------------------------------------------------------------------
# Tests: Reason_Code_Aliases parsing
# ---------------------------------------------------------------------------


class TestReasonCodeAliasesParsing:
    def test_semicolon_aliases_expanded(self):
        data = pd.DataFrame(
            [
                {
                    "Canonical_Reason_Code": "PRICE_VARIANCE",
                    "Accepted_Aliases": "PRICE_VARIANCE;price_variance;Price Variance",
                    "Ambiguity_Rule": "No fuzzy matching.",
                }
            ]
        )
        sheets = {
            **_minimal_sheets(),
            "Reason_Code_Aliases": _with_description_row(data, "Reason Code Aliases"),
        }
        brain = load_rules_brain(_make_workbook(sheets))
        assert brain.reason_code_map["PRICE_VARIANCE"] == "PRICE_VARIANCE"
        assert brain.reason_code_map["price_variance"] == "PRICE_VARIANCE"
        assert brain.reason_code_map["Price Variance"] == "PRICE_VARIANCE"

    def test_no_alias_sheet_gives_empty_map(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        assert brain.reason_code_map == {}


# ---------------------------------------------------------------------------
# Tests: Output_Template parsing
# ---------------------------------------------------------------------------


class TestOutputTemplateParsing:
    def test_default_columns_when_no_template_sheet(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        assert brain.output_columns == DEFAULT_OUTPUT_COLUMNS

    def test_output_template_overrides_defaults(self):
        data = pd.DataFrame(
            [
                {
                    "Column_Name": "Claim_ID",
                    "Required": "Yes",
                    "Default_Value": "",
                    "Source": "DenialRecords",
                    "Instructions": "ID",
                    "Style_This_Column": "No",
                },
                {
                    "Column_Name": "Agent_Status",
                    "Required": "Yes",
                    "Default_Value": "Ready for Resubmission Review",
                    "Source": "Generated",
                    "Instructions": "Status",
                    "Style_This_Column": "Yes",
                },
            ]
        )
        sheets = {
            **_minimal_sheets(),
            "Output_Template": _with_description_row(data, "Current Output Template"),
        }
        brain = load_rules_brain(_make_workbook(sheets))
        assert brain.output_columns == ["Claim_ID", "Agent_Status"]


# ---------------------------------------------------------------------------
# Tests: Output_Defaults parsing (legacy sheet)
# ---------------------------------------------------------------------------


class TestOutputDefaultsParsing:
    def test_ecc_update_type_default(self):
        brain = load_rules_brain(_make_workbook(_minimal_sheets()))
        assert brain.output_defaults.ecc_update_type == "Research Finding Only"

    def test_custom_output_defaults_parsed(self):
        data = pd.DataFrame(
            [
                {"key": "ecc_update_type", "value": "Custom Type"},
                {"key": "financial_posting_allowed", "value": "No"},
                {"key": "pricing_change_allowed", "value": "No"},
            ]
        )
        sheets = {**_minimal_sheets(), "Output_Defaults": data}
        brain = load_rules_brain(_make_workbook(sheets))
        assert brain.output_defaults.ecc_update_type == "Custom Type"
