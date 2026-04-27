"""Validation engine.

Evaluates a list of ValidationRule objects against a merged record
(denial row + joined source row).

Supported operators:
  equals            left == right (string compare)
  not_equals        left != right
  exists            left field is present in the record (key exists and non-blank)
  not_exists        left field is absent or blank
  is_blank          left value is empty / NaN / whitespace-only
  is_not_blank      left value is non-blank
  greater_than      float(left) > float(right)
  less_than         float(left) < float(right)
  between_dates     left date is between right_start and right_end
                    right_field_or_value = "start_field,end_field" (canonical names)
  price_difference  abs(float(left) - float(right)) > tolerance

Each rule produces a RuleResult.  The validation engine aggregates them into
a ScenarioResult for the caller.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

import pandas as pd

from .schemas import ValidationRule


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class RuleResult:
    rule_id: str
    passed: bool
    finding: str
    recommended_action: str
    error: str = ""


@dataclass
class ScenarioResult:
    rule_results: list[RuleResult] = field(default_factory=list)
    research_finding: str = ""
    recommended_next_action: str = ""
    agent_status: str = "Ready for ECC Research Note"

    def add(self, r: RuleResult) -> None:
        self.rule_results.append(r)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _val(record: dict, field_name: str) -> Any:
    """Return the record value for a canonical field name, or None."""
    return record.get(field_name)


def _str_val(record: dict, field_name: str) -> str:
    v = _val(record, field_name)
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    return str(v).strip()


def _is_blank(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and pd.isna(v):
        return True
    return str(v).strip() == ""


def _to_float(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _to_date(v: Any) -> Optional[date]:
    if isinstance(v, date):
        return v
    try:
        return pd.to_datetime(str(v)).date()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Single-rule evaluator
# ---------------------------------------------------------------------------


def _evaluate_rule(rule: ValidationRule, record: dict) -> RuleResult:
    op = rule.operator
    left_raw = _val(record, rule.left_field)
    right_raw = rule.right_field_or_value

    # Determine effective right value (field reference or literal)
    right_resolved: Any = right_raw
    if right_raw and right_raw in record:
        right_resolved = _val(record, right_raw)

    try:
        if op == "equals":
            passed = str(left_raw or "").strip() == str(right_resolved or "").strip()

        elif op == "not_equals":
            passed = str(left_raw or "").strip() != str(right_resolved or "").strip()

        elif op == "exists":
            passed = not _is_blank(left_raw)

        elif op == "not_exists":
            passed = _is_blank(left_raw)

        elif op == "is_blank":
            passed = _is_blank(left_raw)

        elif op == "is_not_blank":
            passed = not _is_blank(left_raw)

        elif op == "greater_than":
            lf = _to_float(left_raw)
            rf = _to_float(right_resolved)
            if lf is None or rf is None:
                raise ValueError("Non-numeric value for greater_than")
            passed = lf > rf

        elif op == "less_than":
            lf = _to_float(left_raw)
            rf = _to_float(right_resolved)
            if lf is None or rf is None:
                raise ValueError("Non-numeric value for less_than")
            passed = lf < rf

        elif op == "between_dates":
            # right_field_or_value = "start_canonical_field,end_canonical_field"
            parts = (right_raw or "").split(",")
            if len(parts) != 2:
                raise ValueError("between_dates requires 'start_field,end_field'")
            start = _to_date(_val(record, parts[0].strip()))
            end = _to_date(_val(record, parts[1].strip()))
            check = _to_date(left_raw)
            if any(x is None for x in (start, end, check)):
                raise ValueError("Could not parse dates for between_dates")
            passed = start <= check <= end

        elif op == "price_difference":
            lf = _to_float(left_raw)
            rf = _to_float(right_resolved)
            if lf is None or rf is None:
                raise ValueError("Non-numeric value for price_difference")
            tol = rule.tolerance if rule.tolerance is not None else 0.0
            passed = abs(lf - rf) <= tol

        else:
            return RuleResult(
                rule_id=rule.rule_id,
                passed=False,
                finding=f"Unknown operator: {op}",
                recommended_action="Manual review required.",
                error=f"Unknown operator '{op}'",
            )

    except Exception as exc:
        return RuleResult(
            rule_id=rule.rule_id,
            passed=False,
            finding=f"Rule evaluation error: {exc}",
            recommended_action="Manual review required.",
            error=str(exc),
        )

    return RuleResult(
        rule_id=rule.rule_id,
        passed=passed,
        finding=rule.research_finding_pass if passed else rule.research_finding_fail,
        recommended_action=rule.recommended_action_pass if passed else rule.recommended_action_fail,
    )


# ---------------------------------------------------------------------------
# Scenario-level evaluator
# ---------------------------------------------------------------------------


def evaluate_scenario_rules(
    rules: list[ValidationRule],
    record: dict,
) -> ScenarioResult:
    """Run all rules for a scenario against the merged record.

    Result logic:
    - All rules pass        → Ready for ECC Research Note
    - Any rule fails        → Needs Manual Review
    - Any evaluation error  → Needs Manual Review
    """
    result = ScenarioResult()
    findings: list[str] = []
    actions: list[str] = []

    for rule in rules:
        rr = _evaluate_rule(rule, record)
        result.add(rr)
        if rr.finding:
            findings.append(rr.finding)
        if rr.recommended_action:
            actions.append(rr.recommended_action)
        if not rr.passed or rr.error:
            result.agent_status = "Needs Manual Review"

    result.research_finding = " | ".join(f for f in findings if f)
    result.recommended_next_action = " | ".join(a for a in actions if a)

    if not rules:
        # No configured validation rules for this scenario
        result.agent_status = "Needs Manual Review"
        result.research_finding = "No validation rules configured for this scenario."
        result.recommended_next_action = "Manual review required."

    return result
