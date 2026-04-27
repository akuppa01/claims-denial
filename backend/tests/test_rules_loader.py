"""Tests for rules_loader.py — parsing the rules brain workbook."""

from __future__ import annotations

import io

import pandas as pd
import pytest
from openpyxl import Workbook

from app.errors import MissingRulesBrainSheetError
from app.rules_loader import DEFAULT_OUTPUT_COLUMNS, load_rules_brain


def _make_workbook(sheets: dict[str, pd.DataFrame]) -> bytes:
    """Write a dict of DataFrames to an in-memory Excel workbook and return bytes."""
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    buf.seek(0)
    return buf.read()


def _minimal_sheets() -> dict[str, pd.DataFrame]:
    field_aliases = pd.DataFrame(
        [
            {"canonical_name": "Claim_ID", "source": "denial_records", "raw_name": "Claim_ID"},
            {"canonical_name": "Denial_ID", "source": "denial_records", "raw_name": "Denial_ID"},
            {"canonical_name": "Reason_Code", "source": "denial_records", "raw_name": "Reason_Code"},
            {"canonical_name": "Material_ID", "source": "denial_records", "raw_name": "Material_ID"},
        ]
    )
    scenarios = pd.DataFrame(
        [
            {
                "scenario_name": "MAT_ATTR_MISMATCH",
                "primary_source": "material_master",
                "join_keys": "Material_ID",
                "secondary_join_keys": "NDC",
                "duplicate_match_strategy": "manual_review",
                "default_agent_status_no_match": "Data Missing",
            }
        ]
    )
    return {"Field_Aliases": field_aliases, "Scenarios": scenarios}


class TestLoadRulesBrain:
    def test_parses_valid_workbook(self):
        wb_bytes = _make_workbook(_minimal_sheets())
        brain = load_rules_brain(wb_bytes)
        assert "MAT_ATTR_MISMATCH" in brain.scenarios
        assert len(brain.field_aliases) == 4

    def test_scenario_join_keys_parsed(self):
        wb_bytes = _make_workbook(_minimal_sheets())
        brain = load_rules_brain(wb_bytes)
        sc = brain.scenarios["MAT_ATTR_MISMATCH"]
        assert sc.join_keys == ["Material_ID"]
        assert sc.secondary_join_keys == ["NDC"]

    def test_raises_on_missing_field_aliases_sheet(self):
        sheets = _minimal_sheets()
        del sheets["Field_Aliases"]
        wb_bytes = _make_workbook(sheets)
        with pytest.raises(MissingRulesBrainSheetError):
            load_rules_brain(wb_bytes)

    def test_raises_on_missing_scenarios_sheet(self):
        sheets = _minimal_sheets()
        del sheets["Scenarios"]
        wb_bytes = _make_workbook(sheets)
        with pytest.raises(MissingRulesBrainSheetError):
            load_rules_brain(wb_bytes)

    def test_default_output_columns_applied_when_no_template_sheet(self):
        wb_bytes = _make_workbook(_minimal_sheets())
        brain = load_rules_brain(wb_bytes)
        assert brain.output_columns == DEFAULT_OUTPUT_COLUMNS

    def test_output_template_overrides_defaults(self):
        sheets = _minimal_sheets()
        sheets["Output_Template"] = pd.DataFrame(
            [{"column_name": "Claim_ID"}, {"column_name": "Agent_Status"}]
        )
        wb_bytes = _make_workbook(sheets)
        brain = load_rules_brain(wb_bytes)
        assert brain.output_columns == ["Claim_ID", "Agent_Status"]

    def test_reason_code_map_parsed(self):
        sheets = _minimal_sheets()
        sheets["Reason_Code_Map"] = pd.DataFrame(
            [
                {"canonical_code": "PRICE_VARIANCE", "variant": "price_variance"},
                {"canonical_code": "PRICE_VARIANCE", "variant": "Price Variance"},
            ]
        )
        wb_bytes = _make_workbook(sheets)
        brain = load_rules_brain(wb_bytes)
        assert brain.reason_code_map["price_variance"] == "PRICE_VARIANCE"
        assert brain.reason_code_map["Price Variance"] == "PRICE_VARIANCE"

    def test_output_defaults_parsed(self):
        sheets = _minimal_sheets()
        sheets["Output_Defaults"] = pd.DataFrame(
            [
                {"key": "ecc_update_type", "value": "Custom Type"},
                {"key": "financial_posting_allowed", "value": "No"},
                {"key": "pricing_change_allowed", "value": "No"},
            ]
        )
        wb_bytes = _make_workbook(sheets)
        brain = load_rules_brain(wb_bytes)
        assert brain.output_defaults.ecc_update_type == "Custom Type"

    def test_validation_rules_parsed(self):
        sheets = _minimal_sheets()
        sheets["Validation_Rules"] = pd.DataFrame(
            [
                {
                    "scenario_name": "MAT_ATTR_MISMATCH",
                    "rule_id": "R001",
                    "left_field": "Material_Type",
                    "operator": "equals",
                    "right_field_or_value": "Branded",
                    "tolerance": "",
                    "research_finding_pass": "Correct type.",
                    "research_finding_fail": "Type mismatch.",
                    "recommended_action_pass": "No action.",
                    "recommended_action_fail": "Review type.",
                }
            ]
        )
        wb_bytes = _make_workbook(sheets)
        brain = load_rules_brain(wb_bytes)
        assert "MAT_ATTR_MISMATCH" in brain.validation_rules
        assert brain.validation_rules["MAT_ATTR_MISMATCH"][0].rule_id == "R001"
