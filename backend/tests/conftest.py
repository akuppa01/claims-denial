"""Shared pytest fixtures."""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.data_sources import InMemoryDataSource
from app.file_registry import FileRegistry
from app.schemas import (
    FieldAlias,
    OutputDefaults,
    RulesBrain,
    ScenarioConfig,
    ValidationRule,
)


# ---------------------------------------------------------------------------
# Minimal RulesBrain factory
# ---------------------------------------------------------------------------


def make_brain(
    scenarios: dict[str, ScenarioConfig] | None = None,
    validation_rules: dict[str, list[ValidationRule]] | None = None,
    field_aliases: list[FieldAlias] | None = None,
    reason_code_map: dict[str, str] | None = None,
) -> RulesBrain:
    from app.rules_loader import DEFAULT_OUTPUT_COLUMNS

    return RulesBrain(
        field_aliases=field_aliases or [],
        scenarios=scenarios or {},
        validation_rules=validation_rules or {},
        reason_code_map=reason_code_map or {},
        output_defaults=OutputDefaults(),
        output_columns=DEFAULT_OUTPUT_COLUMNS[:],
    )


# ---------------------------------------------------------------------------
# Standard scenario configs
# ---------------------------------------------------------------------------


@pytest.fixture()
def mat_attr_scenario() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="MAT_ATTR_MISMATCH",
        primary_source="material_master",
        join_keys=["Material_ID"],
        secondary_join_keys=["NDC"],
        duplicate_match_strategy="manual_review",
        default_agent_status_no_match="Data Missing",
    )


@pytest.fixture()
def cust_eligibility_scenario() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="CUST_ELIGIBILITY",
        primary_source="customer_master",
        join_keys=["Customer_ID"],
        duplicate_match_strategy="manual_review",
        default_agent_status_no_match="Data Missing",
    )


@pytest.fixture()
def contract_mismatch_scenario() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="CONTRACT_MISMATCH",
        primary_source="contracts_data",
        join_keys=["Contract_ID"],
        duplicate_match_strategy="manual_review",
        default_agent_status_no_match="Data Missing",
    )


@pytest.fixture()
def missing_contract_scenario() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="MISSING_CONTRACT",
        primary_source="contracts_data",
        join_keys=["Customer_ID", "Material_ID"],
        duplicate_match_strategy="manual_review",
        default_agent_status_no_match="Data Missing",
    )


@pytest.fixture()
def price_variance_scenario() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="PRICE_VARIANCE",
        primary_source="pricing_data",
        join_keys=["Contract_ID", "Material_ID", "Customer_ID"],
        duplicate_match_strategy="manual_review",
        default_agent_status_no_match="Data Missing",
    )


# ---------------------------------------------------------------------------
# Sample DataFrames
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_denial_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Claim_ID": "CLM001",
                "Denial_ID": "DEN001",
                "Reason_Code": "MAT_ATTR_MISMATCH",
                "Material_ID": "MAT-1",
                "NDC": "12345-678-90",
                "Customer_ID": "CUST-1",
                "Contract_ID": "CON-1",
            }
        ]
    )


@pytest.fixture()
def sample_material_df() -> pd.DataFrame:
    return pd.DataFrame(
        [{"Material_ID": "MAT-1", "NDC": "12345-678-90", "Material_Type": "Branded"}]
    )


@pytest.fixture()
def sample_customer_df() -> pd.DataFrame:
    return pd.DataFrame([{"Customer_ID": "CUST-1", "Eligible": "Yes"}])


@pytest.fixture()
def sample_contracts_df() -> pd.DataFrame:
    return pd.DataFrame(
        [{"Contract_ID": "CON-1", "Customer_ID": "CUST-1", "Material_ID": "MAT-1", "Contract_Price": "100.00"}]
    )


@pytest.fixture()
def sample_pricing_df() -> pd.DataFrame:
    return pd.DataFrame(
        [{"Contract_ID": "CON-1", "Material_ID": "MAT-1", "Customer_ID": "CUST-1", "Price": "100.00"}]
    )


# ---------------------------------------------------------------------------
# FileRegistry fixture
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_registry(
    sample_denial_df,
    sample_material_df,
    sample_customer_df,
    sample_contracts_df,
    sample_pricing_df,
) -> FileRegistry:
    return FileRegistry(
        {
            "denial_records": InMemoryDataSource("denial_records", sample_denial_df),
            "material_master": InMemoryDataSource("material_master", sample_material_df),
            "customer_master": InMemoryDataSource("customer_master", sample_customer_df),
            "contracts_data": InMemoryDataSource("contracts_data", sample_contracts_df),
            "pricing_data": InMemoryDataSource("pricing_data", sample_pricing_df),
        }
    )
