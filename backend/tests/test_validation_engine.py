"""Tests for validation_engine.py — operator coverage and aggregation."""

from __future__ import annotations

import pytest

from app.schemas import ValidationRule
from app.validation_engine import evaluate_scenario_rules


def _rule(
    rule_id: str,
    left_field: str,
    operator: str,
    right: str | None = None,
    tolerance: float | None = None,
    pass_finding: str = "OK",
    fail_finding: str = "FAIL",
    pass_action: str = "No action.",
    fail_action: str = "Review.",
) -> ValidationRule:
    return ValidationRule(
        scenario_name="TEST",
        rule_id=rule_id,
        left_field=left_field,
        operator=operator,
        right_field_or_value=right,
        tolerance=tolerance,
        research_finding_pass=pass_finding,
        research_finding_fail=fail_finding,
        recommended_action_pass=pass_action,
        recommended_action_fail=fail_action,
    )


class TestEqualsOperator:
    def test_pass(self):
        rules = [_rule("R1", "Material_Type", "equals", "Branded")]
        record = {"Material_Type": "Branded"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Ready for ECC Research Note"
        assert "OK" in result.research_finding

    def test_fail(self):
        rules = [_rule("R1", "Material_Type", "equals", "Branded")]
        record = {"Material_Type": "Generic"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Needs Manual Review"
        assert "FAIL" in result.research_finding


class TestNotEqualsOperator:
    def test_pass(self):
        rules = [_rule("R1", "Status", "not_equals", "Inactive")]
        record = {"Status": "Active"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Ready for ECC Research Note"

    def test_fail(self):
        rules = [_rule("R1", "Status", "not_equals", "Inactive")]
        record = {"Status": "Inactive"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Needs Manual Review"


class TestExistsNotExistsOperators:
    def test_exists_pass(self):
        rules = [_rule("R1", "Contract_ID", "exists")]
        result = evaluate_scenario_rules(rules, {"Contract_ID": "CON-1"})
        assert result.agent_status == "Ready for ECC Research Note"

    def test_exists_fail_blank(self):
        rules = [_rule("R1", "Contract_ID", "exists")]
        result = evaluate_scenario_rules(rules, {"Contract_ID": ""})
        assert result.agent_status == "Needs Manual Review"

    def test_not_exists_pass(self):
        rules = [_rule("R1", "Deleted_At", "not_exists")]
        result = evaluate_scenario_rules(rules, {})
        assert result.agent_status == "Ready for ECC Research Note"


class TestIsBlankIsNotBlank:
    def test_is_blank_pass(self):
        rules = [_rule("R1", "Override", "is_blank")]
        result = evaluate_scenario_rules(rules, {"Override": ""})
        assert result.agent_status == "Ready for ECC Research Note"

    def test_is_not_blank_pass(self):
        rules = [_rule("R1", "Override", "is_not_blank")]
        result = evaluate_scenario_rules(rules, {"Override": "something"})
        assert result.agent_status == "Ready for ECC Research Note"


class TestNumericOperators:
    def test_greater_than_pass(self):
        rules = [_rule("R1", "Qty", "greater_than", "0")]
        result = evaluate_scenario_rules(rules, {"Qty": "5"})
        assert result.agent_status == "Ready for ECC Research Note"

    def test_less_than_pass(self):
        rules = [_rule("R1", "Price", "less_than", "200")]
        result = evaluate_scenario_rules(rules, {"Price": "100"})
        assert result.agent_status == "Ready for ECC Research Note"

    def test_non_numeric_yields_manual_review(self):
        rules = [_rule("R1", "Price", "greater_than", "0")]
        result = evaluate_scenario_rules(rules, {"Price": "N/A"})
        assert result.agent_status == "Needs Manual Review"


class TestBetweenDates:
    def test_in_range_pass(self):
        rules = [_rule("R1", "Service_Date", "between_dates", "Start_Date,End_Date")]
        record = {
            "Service_Date": "2026-01-15",
            "Start_Date": "2026-01-01",
            "End_Date": "2026-12-31",
        }
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Ready for ECC Research Note"

    def test_out_of_range_fail(self):
        rules = [_rule("R1", "Service_Date", "between_dates", "Start_Date,End_Date")]
        record = {
            "Service_Date": "2025-06-01",
            "Start_Date": "2026-01-01",
            "End_Date": "2026-12-31",
        }
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Needs Manual Review"

    def test_bad_date_format_yields_manual_review(self):
        rules = [_rule("R1", "Service_Date", "between_dates", "Start_Date,End_Date")]
        record = {
            "Service_Date": "not-a-date",
            "Start_Date": "2026-01-01",
            "End_Date": "2026-12-31",
        }
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Needs Manual Review"


class TestPriceDifference:
    def test_within_tolerance_pass(self):
        rules = [_rule("R1", "Billed_Price", "price_difference", "Contract_Price", tolerance=5.0)]
        record = {"Billed_Price": "102.00", "Contract_Price": "100.00"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Ready for ECC Research Note"

    def test_outside_tolerance_fail(self):
        rules = [_rule("R1", "Billed_Price", "price_difference", "Contract_Price", tolerance=1.0)]
        record = {"Billed_Price": "110.00", "Contract_Price": "100.00"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Needs Manual Review"


class TestNoRules:
    def test_no_rules_yields_manual_review(self):
        result = evaluate_scenario_rules([], {"Any": "data"})
        assert result.agent_status == "Needs Manual Review"
        assert "No validation rules" in result.research_finding


class TestFieldReferenceResolution:
    def test_right_side_resolved_from_record(self):
        rules = [_rule("R1", "Price_A", "equals", "Price_B")]
        record = {"Price_A": "100", "Price_B": "100"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Ready for ECC Research Note"

    def test_right_side_literal_fallback(self):
        rules = [_rule("R1", "Price_A", "equals", "100")]
        record = {"Price_A": "100"}
        result = evaluate_scenario_rules(rules, record)
        assert result.agent_status == "Ready for ECC Research Note"
