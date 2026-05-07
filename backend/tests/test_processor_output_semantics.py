from __future__ import annotations

import pandas as pd

from app.data_sources import InMemoryDataSource
from app.file_registry import FileRegistry
from app.processor import process_claims
from app.schemas import OutputDefaults, RulesBrain, ScenarioConfig


def _brain_for(*scenarios: ScenarioConfig) -> RulesBrain:
    return RulesBrain(
        scenarios={scenario.scenario_name: scenario for scenario in scenarios},
        validation_rules={},
        field_aliases=[],
        reason_code_map={},
        output_defaults=OutputDefaults(),
        output_columns=[],
    )


def _registry(denials: list[dict], **sources: list[dict]) -> FileRegistry:
    frames = {
        "denial_records": InMemoryDataSource("denial_records", pd.DataFrame(denials)),
        "material_master": InMemoryDataSource("material_master", pd.DataFrame(sources.get("material_master", [{}]))),
        "customer_master": InMemoryDataSource("customer_master", pd.DataFrame(sources.get("customer_master", [{}]))),
        "contracts_data": InMemoryDataSource("contracts_data", pd.DataFrame(sources.get("contracts_data", [{}]))),
        "pricing_data": InMemoryDataSource("pricing_data", pd.DataFrame(sources.get("pricing_data", [{}]))),
    }
    return FileRegistry(frames)


def test_customer_eligibility_uses_standard_output_semantics():
    scenario = ScenarioConfig(
        scenario_name="CUST_ELIGIBILITY",
        primary_source="customer_master",
        join_keys=["Customer_ID"],
    )
    brain = _brain_for(scenario)
    registry = _registry(
        denials=[
            {
                "Claim_ID": "CLM001",
                "Denial_ID": "DEN001",
                "Reason_Code": "CUST_ELIGIBILITY",
                "Customer_ID": "C001",
                "Invoice_Date": pd.Timestamp("2026-01-18"),
                "Submission_Date": pd.Timestamp("2026-02-04"),
                "Divestiture_Related_Flag": "No",
            }
        ],
        customer_master=[
            {
                "Customer_ID": "C001",
                "Eligibility_Status": "Eligible",
                "Chargeback_Eligible_Flag": "Yes",
                "Customer_Status": "Active",
            }
        ],
    )

    out = process_claims(brain, registry)[0]
    assert out["Agent_Status"] == "Closed - Research Complete"
    assert out["Denial_Decision"] == "Acceptable Denial"
    assert out["Resubmission_Recommended"] == "No"
    assert out["Primary_Source_Checked"] == "Customer Master"
    assert out["Secondary_Source_Checked"] == "Contracts Data"
    assert out["Research_Finding"] == "Customer eligibility issue identified."
    assert out["Discrepancy_Details"] == (
        "Customer eligibility, active status, or chargeback eligibility requires validation."
    )
    assert out["Recommended_Next_Action"] == (
        "Document denial as valid. No resubmission recommended."
    )
    assert out["Data_Validation_Result"] == "Mismatch"
    assert out["Invoice_Date"] == "2026-01-18"
    assert out["Submission_Date"] == "2026-02-04"


def test_missing_contract_uses_contracts_label_and_missing_result():
    scenario = ScenarioConfig(
        scenario_name="MISSING_CONTRACT",
        primary_source="contracts_data",
        join_keys=["Customer_ID", "Material_ID"],
    )
    brain = _brain_for(scenario)
    registry = _registry(
        denials=[
            {
                "Claim_ID": "CLM002",
                "Denial_ID": "DEN002",
                "Reason_Code": "MISSING_CONTRACT",
                "Customer_ID": "C002",
                "Material_ID": "M002",
                "Invoice_Date": pd.Timestamp("2026-03-20"),
                "Submission_Date": pd.Timestamp("2026-04-10"),
                "Divestiture_Related_Flag": "No",
            }
        ],
        contracts_data=[],
    )

    out = process_claims(brain, registry)[0]
    assert out["Primary_Source_Checked"] == "Contracts Data"
    assert out["Secondary_Source_Checked"] == "Material Master, Customer Master"
    assert out["Research_Finding"] == "Missing contract assignment identified."
    assert out["Discrepancy_Details"] == "No valid contract found for customer/material combination."
    assert out["Data_Validation_Result"] == "Missing"
    assert out["Denial_Decision"] == "Acceptable Denial"
    assert out["Agent_Status"] == "Closed - Research Complete"


def test_divest_customer_not_eligible_uses_expected_source_labels():
    scenario = ScenarioConfig(
        scenario_name="DIVEST_CUSTOMER_NOT_ELIGIBLE",
        primary_source="contracts_data",
        join_keys=["Customer_ID", "Material_ID"],
    )
    brain = _brain_for(scenario)
    registry = _registry(
        denials=[
            {
                "Claim_ID": "CLM90014",
                "Denial_ID": "DEN90014",
                "Reason_Code": "DIVEST_CUSTOMER_NOT_ELIGIBLE",
                "Customer_ID": "C90014",
                "Material_ID": "M90014",
                "Contract_ID": "CT90014",
                "Invoice_Date": pd.Timestamp("2026-07-09"),
                "Submission_Date": pd.Timestamp("2026-08-02"),
                "Divestiture_Related_Flag": "Yes",
            }
        ],
        contracts_data=[
            {
                "Customer_ID": "C90014",
                "Material_ID": "M90014",
                "Contract_ID": "CT90014",
                "Chargeback_Eligible_Flag": "No",
                "Contract_Assignment_Status": "Ineligible",
            }
        ],
    )

    out = process_claims(brain, registry)[0]
    assert out["Primary_Source_Checked"] == "Customer Master"
    assert out["Secondary_Source_Checked"] == "Contracts Data"
    assert out["Research_Finding"] == "Customer not eligible under current manufacturer contract."
    assert out["Denial_Decision"] == "Acceptable Denial"
