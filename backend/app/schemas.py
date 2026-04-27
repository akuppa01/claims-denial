"""Pydantic models for parsed rules brain configuration."""

from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Field alias / dictionary
# ---------------------------------------------------------------------------


class FieldAlias(BaseModel):
    canonical_name: str
    source: str       # e.g. "denial_records", "contracts_data"
    raw_name: str     # actual column name in the source file


# ---------------------------------------------------------------------------
# Scenario configuration
# ---------------------------------------------------------------------------


class ScenarioConfig(BaseModel):
    scenario_name: str
    primary_source: str                       # source key, e.g. "material_master"
    join_keys: list[str]                      # canonical field names
    secondary_join_keys: list[str] = Field(default_factory=list)
    duplicate_match_strategy: str = "manual_review"   # "manual_review" | "first"
    default_agent_status_no_match: str = "Data Missing"


# ---------------------------------------------------------------------------
# Validation rules
# ---------------------------------------------------------------------------


class ValidationRule(BaseModel):
    scenario_name: str
    rule_id: str
    left_field: str          # canonical field from denial/joined record
    operator: str            # equals | not_equals | exists | not_exists |
                             # is_blank | is_not_blank | greater_than |
                             # less_than | between_dates | price_difference
    right_field_or_value: Optional[str] = None  # canonical field name OR literal
    tolerance: Optional[float] = None           # for price_difference
    research_finding_pass: str = ""
    research_finding_fail: str = ""
    recommended_action_pass: str = ""
    recommended_action_fail: str = ""


# ---------------------------------------------------------------------------
# Reason code mapping
# ---------------------------------------------------------------------------


class ReasonCodeEntry(BaseModel):
    canonical_code: str
    variant: str      # e.g. "price_variance", "Price Variance"


# ---------------------------------------------------------------------------
# Output defaults
# ---------------------------------------------------------------------------


class OutputDefaults(BaseModel):
    ecc_update_type: str = "Research Finding Only"
    financial_posting_allowed: str = "No"
    pricing_change_allowed: str = "No"


# ---------------------------------------------------------------------------
# Full parsed rules brain
# ---------------------------------------------------------------------------


class RulesBrain(BaseModel):
    field_aliases: List[FieldAlias] = Field(default_factory=list)
    scenarios: dict = Field(default_factory=dict)
    validation_rules: dict = Field(default_factory=dict)
    reason_code_map: dict = Field(default_factory=dict)  # variant -> canonical
    output_defaults: OutputDefaults = Field(default_factory=OutputDefaults)
    output_columns: List[str] = Field(default_factory=list)
    raw_sheets: dict = Field(default_factory=dict)  # sheet_name -> raw DataFrame

    model_config = {"arbitrary_types_allowed": True}
