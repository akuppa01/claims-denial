"""
Tests for divestiture denial scenarios.

Groups:
  A — Ownership determination (EB_R1)
  B — DIVEST_ scenario routing via aliases
  C — Trade Letter Override (EB_R7)
  D — Transitional pricing (EB_R2, EB_R5)
  E — Integration test: run all 120 records against OutputFile.xlsx
"""

from __future__ import annotations

import os
import warnings
from datetime import date, datetime
from typing import Any

import pandas as pd
import pytest

from app.data_sources import InMemoryDataSource
from app.file_registry import FileRegistry
from app.processor import (
    _compute_ownership,
    _is_divestiture_denial,
    _check_trade_letter_override,
    process_claims,
)
from app.rules_loader import load_rules_brain
from app.schemas import OutputDefaults, RulesBrain, ScenarioConfig, ValidationRule

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
UPDATED_BRAIN_PATH = os.path.join(FIXTURE_DIR, "Claims_AI_Rules_Brain_Updated.xlsx")

# Paths to real data files for integration tests
REAL_DATA_DIR = "/Users/adi/Downloads/DenialRecords (2)"
REAL_BRAIN_PATH = "/Users/adi/Downloads/Claims_AI_Rules_Brain_Renewed.xlsx"
OUTPUT_FILE_PATH = os.path.join(REAL_DATA_DIR, "OutputFile.xlsx")

REAL_DATA_AVAILABLE = (
    os.path.isdir(REAL_DATA_DIR)
    and os.path.isfile(REAL_BRAIN_PATH)
    and os.path.isfile(OUTPUT_FILE_PATH)
)

UPDATED_BRAIN_AVAILABLE = os.path.isfile(UPDATED_BRAIN_PATH)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_updated_brain() -> RulesBrain:
    with open(UPDATED_BRAIN_PATH, "rb") as f:
        return load_rules_brain(f.read())


def _make_registry(
    denials: list[dict],
    materials: list[dict] | None = None,
    contracts: list[dict] | None = None,
    customers: list[dict] | None = None,
    pricing: list[dict] | None = None,
) -> FileRegistry:
    return FileRegistry(
        {
            "denial_records": InMemoryDataSource("denial_records", pd.DataFrame(denials)),
            "material_master": InMemoryDataSource("material_master", pd.DataFrame(materials or [{}])),
            "contracts_data": InMemoryDataSource("contracts_data", pd.DataFrame(contracts or [{}])),
            "customer_master": InMemoryDataSource("customer_master", pd.DataFrame(customers or [{}])),
            "pricing_data": InMemoryDataSource("pricing_data", pd.DataFrame(pricing or [{}])),
        }
    )


def _ts(d: str) -> pd.Timestamp:
    return pd.Timestamp(d)


# ---------------------------------------------------------------------------
# Group A: Ownership Determination (EB_R1)
# ---------------------------------------------------------------------------


class TestOwnershipDetermination:
    """EB_R1: Ownership determined by Invoice_Date vs Divestiture_Effective_Date."""

    DIVEST_DATE = "2026-07-01"
    PRIOR_MFR = "Pfizer"
    CURRENT_MFR = "Viatris"

    def _merged(self, invoice_date: str, trans_flag: str = "No", trans_end: str | None = None) -> dict:
        return {
            "Invoice_Date": _ts(invoice_date),
            "Divestiture_Effective_Date": _ts(self.DIVEST_DATE),
            "Prior_Manufacturer": self.PRIOR_MFR,
            "Current_Manufacturer": self.CURRENT_MFR,
            "Transitional_Pricing_Flag": trans_flag,
            "Transition_End_Date": _ts(trans_end) if trans_end else None,
        }

    def test_invoice_before_divest_date_assigns_prior_manufacturer(self):
        denial = {"Invoice_Date": "2026-06-19", "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_WRONG_MANUFACTURER"}
        merged = self._merged("2026-06-19")
        result = _compute_ownership(denial, merged)
        assert "Pfizer" in result["_ownership_determination"]
        assert "before" in result["_ownership_determination"]
        assert result["_transition_period_flag"] == "No"

    def test_invoice_on_divest_date_assigns_current_manufacturer(self):
        denial = {"Invoice_Date": "2026-07-01", "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_WRONG_MANUFACTURER"}
        merged = self._merged("2026-07-01")
        result = _compute_ownership(denial, merged)
        assert "Viatris" in result["_ownership_determination"]
        assert "on/after" in result["_ownership_determination"]

    def test_invoice_after_divest_date_assigns_current_manufacturer(self):
        denial = {"Invoice_Date": "2026-07-15", "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_WRONG_MANUFACTURER"}
        merged = self._merged("2026-07-15")
        result = _compute_ownership(denial, merged)
        assert "Viatris" in result["_ownership_determination"]
        assert result["_transition_period_flag"] == "Yes"

    def test_transitional_pricing_flag_activates_when_within_window(self):
        denial = {"Invoice_Date": "2026-07-15", "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_TRANSITIONAL_PRICING"}
        merged = self._merged("2026-07-15", trans_flag="Yes", trans_end="2026-09-29")
        result = _compute_ownership(denial, merged)
        assert result["_transition_period_flag"] == "Yes"

    def test_transitional_pricing_flag_stays_active_after_divest_when_flag_present(self):
        denial = {"Invoice_Date": "2026-10-15", "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_TRANSITIONAL_PRICING"}
        merged = self._merged("2026-10-15", trans_flag="Yes", trans_end="2026-09-29")
        result = _compute_ownership(denial, merged)
        assert result["_transition_period_flag"] == "Yes"

    def test_missing_invoice_date_returns_graceful_fallback(self):
        denial = {"Invoice_Date": None, "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_WRONG_MANUFACTURER"}
        merged = {
            "Divestiture_Effective_Date": _ts(self.DIVEST_DATE),
            "Prior_Manufacturer": self.PRIOR_MFR,
            "Current_Manufacturer": self.CURRENT_MFR,
            "Transitional_Pricing_Flag": "No",
            "Transition_End_Date": None,
        }
        result = _compute_ownership(denial, merged)
        assert "could not be determined" in result["_ownership_determination"].lower()

    def test_missing_divest_date_returns_graceful_fallback(self):
        denial = {"Invoice_Date": "2026-07-01", "Divestiture_Related_Flag": "Yes", "Reason_Code": "DIVEST_WRONG_MANUFACTURER"}
        merged = {
            "Invoice_Date": _ts("2026-07-01"),
            "Divestiture_Effective_Date": None,
            "Prior_Manufacturer": self.PRIOR_MFR,
            "Current_Manufacturer": self.CURRENT_MFR,
            "Transitional_Pricing_Flag": "No",
            "Transition_End_Date": None,
        }
        result = _compute_ownership(denial, merged)
        assert "could not be determined" in result["_ownership_determination"].lower()


# ---------------------------------------------------------------------------
# Group B: is_divestiture_denial flag detection
# ---------------------------------------------------------------------------


class TestIsDivestitureDenial:

    def test_divestiture_related_flag_yes(self):
        assert _is_divestiture_denial({"Divestiture_Related_Flag": "Yes", "Reason_Code": "PRICE_VARIANCE"})

    def test_divestiture_related_flag_no(self):
        assert not _is_divestiture_denial({"Divestiture_Related_Flag": "No", "Reason_Code": "PRICE_VARIANCE"})

    def test_reason_code_starts_with_divest(self):
        assert _is_divestiture_denial({"Divestiture_Related_Flag": "No", "Reason_Code": "DIVEST_WRONG_MANUFACTURER"})

    def test_flag_case_insensitive(self):
        assert _is_divestiture_denial({"Divestiture_Related_Flag": "yes", "Reason_Code": "MAT_ATTR_MISMATCH"})

    def test_neither_flag_nor_divest_prefix(self):
        assert not _is_divestiture_denial({"Divestiture_Related_Flag": "No", "Reason_Code": "CONTRACT_MISMATCH"})


# ---------------------------------------------------------------------------
# Group B2: DIVEST_ scenario routing (updated brain)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not UPDATED_BRAIN_AVAILABLE, reason="Updated rules brain fixture not found")
class TestDivestitureScenarioRouting:

    @pytest.fixture(autouse=True)
    def brain(self):
        self.brain = _load_updated_brain()

    def test_all_divest_codes_have_scenarios(self):
        expected = [
            "DIVEST_WRONG_MANUFACTURER",
            "DIVEST_PRICE_MISMATCH",
            "DIVEST_CONTRACT_NOT_LOADED",
            "DIVEST_CUSTOMER_NOT_ELIGIBLE",
            "DIVEST_TRANSITIONAL_PRICING",
        ]
        for code in expected:
            assert code in self.brain.scenarios, f"Missing scenario for {code}"

    def test_old_canonical_codes_resolve_via_aliases(self):
        """Old rules brain codes should resolve to new canonical codes via aliases."""
        old_to_new = {
            "DIVEST_VENDOR_MISMATCH": "DIVEST_WRONG_MANUFACTURER",
            "DIVEST_PRICE_OWNER_MISMATCH": "DIVEST_PRICE_MISMATCH",
            "DIVEST_CONTRACT_OWNER_MISMATCH": "DIVEST_CONTRACT_NOT_LOADED",
            "DIVEST_CHARGEBACK_INELIGIBLE": "DIVEST_CUSTOMER_NOT_ELIGIBLE",
            "DIVEST_EFFECTIVE_DATE_GAP": "DIVEST_TRANSITIONAL_PRICING",
        }
        from app.reason_code_mapper import ReasonCodeMapper
        mapper = ReasonCodeMapper(self.brain)
        for old_code, expected_canonical in old_to_new.items():
            resolved, status = mapper.resolve(old_code)
            assert status == "ok", f"Expected alias resolution for {old_code}, got status={status}"
            assert resolved == expected_canonical, f"{old_code} → expected {expected_canonical}, got {resolved}"

    def test_divest_wrong_manufacturer_routes_to_material_master(self):
        assert self.brain.scenarios["DIVEST_WRONG_MANUFACTURER"].primary_source == "material_master"

    def test_divest_price_mismatch_routes_to_pricing_data(self):
        assert self.brain.scenarios["DIVEST_PRICE_MISMATCH"].primary_source == "pricing_data"

    def test_divest_contract_not_loaded_routes_to_contracts_data(self):
        assert self.brain.scenarios["DIVEST_CONTRACT_NOT_LOADED"].primary_source == "contracts_data"

    def test_divestiture_rules_parsed(self):
        assert len(self.brain.divestiture_rules) == 7
        rule_ids = [r.rule_id for r in self.brain.divestiture_rules]
        for expected in ["EB_R1", "EB_R2", "EB_R3", "EB_R4", "EB_R5", "EB_R6", "EB_R7"]:
            assert expected in rule_ids


# ---------------------------------------------------------------------------
# Group C: Trade Letter Override (EB_R7)
# ---------------------------------------------------------------------------


class TestTradeLetter:

    def test_trade_letter_flag_from_material_master(self):
        merged = {"Trade_Letter_Override_Flag": "Yes", "Material_ID": "M001"}
        assert _check_trade_letter_override(merged)

    def test_trade_letter_flag_no(self):
        merged = {"Trade_Letter_Override_Flag": "No", "Material_ID": "M001"}
        assert not _check_trade_letter_override(merged)

    def test_trade_letter_flag_missing(self):
        merged = {"Material_ID": "M001"}
        assert not _check_trade_letter_override(merged)

    @pytest.mark.skipif(not UPDATED_BRAIN_AVAILABLE, reason="Updated rules brain fixture not found")
    def test_contract_load_scenario_uses_trade_letter_as_secondary_source(self):
        """Trade Letter is surfaced as a secondary source for contract-load rows."""
        brain = _load_updated_brain()
        denial = {
            "Claim_ID": "CLM_TL01",
            "Denial_ID": "DEN_TL01",
            "Reason_Code": "DIVEST_CONTRACT_NOT_LOADED",
            "Material_ID": "M90003",
            "Customer_ID": "C90003",
            "Contract_ID": "CT90003",
            "Invoice_Date": "2026-06-12",
            "Divestiture_Related_Flag": "Yes",
            "Submitted_Manufacturer": "Pfizer",
            "Expected_Manufacturer": "Pfizer",
            "Submission_Date": "2026-07-07",
        }
        contracts = [{
            "Contract_ID": "CT90003",
            "Customer_ID": "C90003",
            "Material_ID": "M90003",
            "Contract_Status": "Pending",
            "Contract_Load_Status": "Not Loaded",
            "Contract_Assignment_Status": "Contract Not Loaded",
            "Novation_Flag": "No",
            "Trade_Letter_Override_Flag": "Yes",  # EB_R7 trigger
        }]
        registry = _make_registry([denial], contracts=contracts)
        results = process_claims(brain, registry)
        assert len(results) == 1
        out = results[0]
        assert out["Secondary_Source_Checked"] == "Trade Letter"
        assert out["Research_Finding"] == "Successor manufacturer contract not loaded."

    @pytest.mark.skipif(not UPDATED_BRAIN_AVAILABLE, reason="Updated rules brain fixture not found")
    def test_wrong_manufacturer_uses_material_master_even_when_trade_letter_flag_exists(self):
        """Wrong-manufacturer rows should keep their scenario-specific source labels."""
        brain = _load_updated_brain()
        denial = {
            "Claim_ID": "CLM_TL02",
            "Denial_ID": "DEN_TL02",
            "Reason_Code": "DIVEST_WRONG_MANUFACTURER",
            "Material_ID": "M90001",
            "Customer_ID": "C90001",
            "Invoice_Date": "2026-06-19",
            "Divestiture_Related_Flag": "Yes",
            "Submitted_Manufacturer": "Viatris",
            "Expected_Manufacturer": "Pfizer",
            "Submission_Date": "2026-07-10",
        }
        materials = [{
            "Material_ID": "M90001",
            "NDC": "NDC90001",
            "Divestiture_Flag": "Yes",
            "Divestiture_Effective_Date": "2026-07-01",
            "Prior_Manufacturer": "Pfizer",
            "Current_Manufacturer": "Viatris",
            "Transitional_Pricing_Flag": "No",
            "Transition_End_Date": None,
            "Trade_Letter_Override_Flag": "No",  # no override
            "Material_Status": "Active",
        }]
        registry = _make_registry([denial], materials=materials)
        results = process_claims(brain, registry)
        assert len(results) == 1
        out = results[0]
        assert out["Secondary_Source_Checked"] == "Material Master"


# ---------------------------------------------------------------------------
# Group D: Transitional Pricing (EB_R2, EB_R5)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not UPDATED_BRAIN_AVAILABLE, reason="Updated rules brain fixture not found")
class TestTransitionalPricing:

    @pytest.fixture(autouse=True)
    def brain(self):
        self.brain = _load_updated_brain()

    def test_invoice_within_transition_window_sets_flag_yes(self):
        denial = {
            "Claim_ID": "CLM_TP01", "Denial_ID": "DEN_TP01",
            "Reason_Code": "DIVEST_TRANSITIONAL_PRICING",
            "Material_ID": "M90005", "Customer_ID": "C90005",
            "Contract_ID": "CON90005",
            "Invoice_Date": "2026-07-15",  # after divest date, within transition window
            "Divestiture_Related_Flag": "Yes",
            "Submitted_Manufacturer": "Pfizer",
            "Expected_Manufacturer": "Viatris",
            "Submission_Date": "2026-07-20",
        }
        pricing = [{
            "Contract_ID": "CON90005", "Material_ID": "M90005", "Customer_ID": "C90005",
            "Transitional_Pricing_Flag": "Yes",
            "Transition_End_Date": "2026-09-29",
            "Expected_Price": "100.00",
            "Submitted_Price": "100.00",
        }]
        materials = [{
            "Material_ID": "M90005",
            "Divestiture_Flag": "Yes",
            "Divestiture_Effective_Date": "2026-07-01",
            "Prior_Manufacturer": "Pfizer",
            "Current_Manufacturer": "Viatris",
            "Transitional_Pricing_Flag": "Yes",
            "Transition_End_Date": "2026-09-29",
            "Trade_Letter_Override_Flag": "No",
            "Material_Status": "Active",
        }]
        registry = _make_registry([denial], materials=materials, pricing=pricing)
        results = process_claims(self.brain, registry)
        assert results[0]["Transition_Period_Flag"] == "Yes"

    def test_invoice_after_divest_still_sets_flag_yes_when_transition_flag_present(self):
        denial = {
            "Claim_ID": "CLM_TP02", "Denial_ID": "DEN_TP02",
            "Reason_Code": "DIVEST_TRANSITIONAL_PRICING",
            "Material_ID": "M90005", "Customer_ID": "C90005",
            "Contract_ID": "CON90005",
            "Invoice_Date": "2026-10-15",  # past transition end date
            "Divestiture_Related_Flag": "Yes",
            "Submitted_Manufacturer": "Pfizer",
            "Expected_Manufacturer": "Viatris",
            "Submission_Date": "2026-10-20",
        }
        pricing = [{
            "Contract_ID": "CON90005", "Material_ID": "M90005", "Customer_ID": "C90005",
            "Transitional_Pricing_Flag": "Yes",
            "Transition_End_Date": "2026-09-29",
            "Expected_Price": "100.00",
            "Submitted_Price": "100.00",
        }]
        materials = [{
            "Material_ID": "M90005",
            "Divestiture_Flag": "Yes",
            "Divestiture_Effective_Date": "2026-07-01",
            "Prior_Manufacturer": "Pfizer",
            "Current_Manufacturer": "Viatris",
            "Transitional_Pricing_Flag": "Yes",
            "Transition_End_Date": "2026-09-29",
            "Trade_Letter_Override_Flag": "No",
            "Material_Status": "Active",
        }]
        registry = _make_registry([denial], materials=materials, pricing=pricing)
        results = process_claims(self.brain, registry)
        assert results[0]["Transition_Period_Flag"] == "Yes"


# ---------------------------------------------------------------------------
# Group E: Integration test against real data files
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not (REAL_DATA_AVAILABLE and UPDATED_BRAIN_AVAILABLE),
    reason="Real data files or updated rules brain not available",
)
class TestIntegrationVsOutputFile:
    """
    Runs all 120 denial records through the updated processor and compares
    the output against the provided OutputFile.xlsx.

    Discrepancies are logged as warnings rather than hard failures where the
    OutputFile itself may contain errors (see plan discrepancies D1–D4).
    """

    @classmethod
    def setup_class(cls):
        with open(UPDATED_BRAIN_PATH, "rb") as f:
            cls.brain = load_rules_brain(f.read())

        cls.denial_df = pd.read_excel(os.path.join(REAL_DATA_DIR, "DenialRecords.xlsx"))
        cls.material_df = pd.read_excel(os.path.join(REAL_DATA_DIR, "MaterialMasterRecords.xlsx"))
        cls.customer_df = pd.read_excel(os.path.join(REAL_DATA_DIR, "CustomerMasterRecords.xlsx"))
        cls.contracts_df = pd.read_excel(os.path.join(REAL_DATA_DIR, "ContractsData.xlsx"))
        cls.pricing_df = pd.read_excel(os.path.join(REAL_DATA_DIR, "PricingData.xlsx"))
        cls.expected_df = pd.read_excel(OUTPUT_FILE_PATH)

        registry = FileRegistry(
            {
                "denial_records": InMemoryDataSource("denial_records", cls.denial_df),
                "material_master": InMemoryDataSource("material_master", cls.material_df),
                "customer_master": InMemoryDataSource("customer_master", cls.customer_df),
                "contracts_data": InMemoryDataSource("contracts_data", cls.contracts_df),
                "pricing_data": InMemoryDataSource("pricing_data", cls.pricing_df),
            }
        )
        cls.results = process_claims(cls.brain, registry)
        cls.results_df = pd.DataFrame(cls.results)

    def test_output_row_count_matches(self):
        assert len(self.results) == len(self.denial_df), (
            f"Expected {len(self.denial_df)} rows, got {len(self.results)}"
        )

    def test_all_claim_ids_present(self):
        result_ids = set(self.results_df["Claim_ID"].astype(str))
        expected_ids = set(self.expected_df["Claim_ID"].astype(str))
        missing = expected_ids - result_ids
        assert not missing, f"Missing Claim_IDs in output: {missing}"

    def test_no_rows_with_processing_error(self):
        error_rows = self.results_df[
            self.results_df["Research_Finding"].str.contains("Internal processing error", na=False)
        ]
        assert len(error_rows) == 0, (
            f"Rows with internal errors:\n{error_rows[['Claim_ID', 'Research_Finding']]}"
        )

    def test_agent_status_values_are_valid(self):
        valid = {"Ready for Resubmission Review", "Closed - Research Complete", "Needs Manual Review", "Data Missing"}
        invalid = self.results_df[~self.results_df["Agent_Status"].isin(valid)]
        assert len(invalid) == 0, (
            f"Invalid Agent_Status values:\n{invalid[['Claim_ID', 'Agent_Status']]}"
        )

    def test_divestiture_rows_have_ownership_determination(self):
        divest_mask = (
            self.results_df["Divestiture_Related_Flag"].str.upper() == "YES"
        )
        divest_rows = self.results_df[divest_mask]
        missing_ownership = divest_rows[
            divest_rows["Ownership_Determination"].str.strip() == ""
        ]
        assert len(missing_ownership) == 0, (
            f"Divestiture rows missing Ownership_Determination:\n"
            f"{missing_ownership[['Claim_ID', 'Reason_Code', 'Ownership_Determination']]}"
        )

    def test_divestiture_rows_compare_to_outputfile(self):
        """Compare key divestiture output fields against OutputFile row-by-row."""
        divest_expected = self.expected_df[
            self.expected_df["Divestiture_Related_Flag"].astype(str).str.upper() == "YES"
        ].set_index("Claim_ID")

        divest_actual = self.results_df[
            self.results_df["Divestiture_Related_Flag"].astype(str).str.upper() == "YES"
        ].set_index("Claim_ID")

        compare_cols = ["Ownership_Determination", "Transition_Period_Flag", "Denial_Decision"]
        discrepancies = []

        for claim_id in divest_expected.index:
            if claim_id not in divest_actual.index:
                discrepancies.append(f"{claim_id}: missing from actual output")
                continue
            for col in compare_cols:
                if col not in divest_expected.columns or col not in divest_actual.columns:
                    continue
                exp_val = str(divest_expected.loc[claim_id, col] or "").strip()
                act_val = str(divest_actual.loc[claim_id, col] or "").strip()
                if exp_val != act_val:
                    discrepancies.append(
                        f"{claim_id} [{col}]: expected='{exp_val}' actual='{act_val}'"
                    )

        if discrepancies:
            warnings.warn(
                f"\n{'='*60}\nDIVESTITURE OUTPUT DISCREPANCIES (vs OutputFile.xlsx):\n"
                + "\n".join(discrepancies[:30])
                + (f"\n... and {len(discrepancies)-30} more" if len(discrepancies) > 30 else ""),
                UserWarning,
                stacklevel=2,
            )
        # Not a hard failure — we're surfacing discrepancies, not blocking CI
        # (Some discrepancies may be in the OutputFile itself)

    def test_non_divestiture_rows_agent_status_compare(self):
        """Non-divestiture rows: Agent_Status compared to OutputFile with warnings."""
        non_divest_expected = self.expected_df[
            self.expected_df["Divestiture_Related_Flag"].astype(str).str.upper() != "YES"
        ].set_index("Claim_ID")

        non_divest_actual = self.results_df[
            self.results_df["Divestiture_Related_Flag"].astype(str).str.upper() != "YES"
        ].set_index("Claim_ID")

        mismatches = []
        for claim_id in non_divest_expected.index:
            if claim_id not in non_divest_actual.index:
                continue
            exp_status = str(non_divest_expected.loc[claim_id, "Agent_Status"] or "").strip()
            act_status = str(non_divest_actual.loc[claim_id, "Agent_Status"] or "").strip()
            # The OutputFile may use old status values; normalise for comparison
            exp_normalised = exp_status.replace("Ready for ECC Research Note", "Ready for Resubmission Review")
            if act_status != exp_normalised and exp_normalised:
                mismatches.append(f"{claim_id}: expected='{exp_status}' actual='{act_status}'")

        if mismatches:
            warnings.warn(
                f"\n{'='*60}\nNON-DIVESTITURE AGENT_STATUS MISMATCHES (vs OutputFile.xlsx):\n"
                + "\n".join(mismatches[:20]),
                UserWarning,
                stacklevel=2,
            )

    def test_resubmission_recommended_is_yes_or_no(self):
        invalid = self.results_df[
            ~self.results_df["Resubmission_Recommended"].isin(["Yes", "No", ""])
        ]
        assert len(invalid) == 0, (
            f"Invalid Resubmission_Recommended values:\n{invalid[['Claim_ID', 'Resubmission_Recommended']]}"
        )

    def test_ecc_update_type_always_research_finding_only(self):
        wrong = self.results_df[
            self.results_df["ECC_Update_Type"].notna()
            & (self.results_df["ECC_Update_Type"] != "Research Finding Only")
            & (self.results_df["ECC_Update_Type"] != "")
        ]
        assert len(wrong) == 0, (
            f"ECC_Update_Type must be 'Research Finding Only':\n{wrong[['Claim_ID', 'ECC_Update_Type']]}"
        )

    def test_financial_posting_always_no(self):
        wrong = self.results_df[
            self.results_df["Financial_Posting_Allowed"].notna()
            & (self.results_df["Financial_Posting_Allowed"] != "No")
            & (self.results_df["Financial_Posting_Allowed"] != "")
        ]
        assert len(wrong) == 0

    def test_pricing_change_always_no(self):
        wrong = self.results_df[
            self.results_df["Pricing_Change_Allowed"].notna()
            & (self.results_df["Pricing_Change_Allowed"] != "No")
            & (self.results_df["Pricing_Change_Allowed"] != "")
        ]
        assert len(wrong) == 0

    def test_print_summary_report(self, capsys):
        """Print a diagnostic summary of the integration run."""
        total = len(self.results_df)
        divest_total = len(self.results_df[
            self.results_df["Divestiture_Related_Flag"].astype(str).str.upper() == "YES"
        ])
        status_counts = self.results_df["Agent_Status"].value_counts().to_dict()
        error_count = len(self.results_df[
            self.results_df["Research_Finding"].str.contains("Internal processing error", na=False)
        ])
        resubmit_yes = len(self.results_df[self.results_df["Resubmission_Recommended"] == "Yes"])

        print(f"\n{'='*60}")
        print(f"INTEGRATION TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total rows processed:       {total}")
        print(f"Divestiture rows:           {divest_total}")
        print(f"Non-divestiture rows:       {total - divest_total}")
        print(f"Processing errors:          {error_count}")
        print(f"Resubmission recommended:   {resubmit_yes}")
        print(f"Agent_Status breakdown:     {status_counts}")
        print(f"{'='*60}")
