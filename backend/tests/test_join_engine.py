"""Tests for join_engine.py — all five scenario join patterns."""

from __future__ import annotations

import pandas as pd
import pytest

from app.join_engine import join_denial_to_source, join_with_fallback_keys
from app.schemas import ScenarioConfig


def _scenario(name: str, source: str, keys: list[str], secondary: list[str] | None = None) -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name=name,
        primary_source=source,
        join_keys=keys,
        secondary_join_keys=secondary or [],
        duplicate_match_strategy="manual_review",
    )


class TestJoinDenialToSource:
    # ------------------------------------------------------------------
    # MAT_ATTR_MISMATCH: join by Material_ID
    # ------------------------------------------------------------------
    def test_mat_attr_mismatch_single_match(self):
        denial = {"Material_ID": "MAT-1"}
        source = pd.DataFrame([{"Material_ID": "MAT-1", "Type": "Branded"}])
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "ok"
        assert result.matched_row["Material_ID"] == "MAT-1"

    def test_mat_attr_mismatch_no_match(self):
        denial = {"Material_ID": "MAT-999"}
        source = pd.DataFrame([{"Material_ID": "MAT-1", "Type": "Branded"}])
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "no_match"
        assert result.matched_row is None

    def test_mat_attr_mismatch_duplicate(self):
        denial = {"Material_ID": "MAT-1"}
        source = pd.DataFrame(
            [
                {"Material_ID": "MAT-1", "Type": "Branded"},
                {"Material_ID": "MAT-1", "Type": "Generic"},
            ]
        )
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "duplicate"
        assert len(result.rows) == 2

    # ------------------------------------------------------------------
    # CUST_ELIGIBILITY: join by Customer_ID
    # ------------------------------------------------------------------
    def test_cust_eligibility_single_match(self):
        denial = {"Customer_ID": "CUST-1"}
        source = pd.DataFrame([{"Customer_ID": "CUST-1", "Eligible": "Yes"}])
        sc = _scenario("CUST_ELIGIBILITY", "customer_master", ["Customer_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "ok"

    # ------------------------------------------------------------------
    # CONTRACT_MISMATCH: join by Contract_ID
    # ------------------------------------------------------------------
    def test_contract_mismatch_match(self):
        denial = {"Contract_ID": "CON-1"}
        source = pd.DataFrame([{"Contract_ID": "CON-1", "Price": "100"}])
        sc = _scenario("CONTRACT_MISMATCH", "contracts_data", ["Contract_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "ok"

    # ------------------------------------------------------------------
    # MISSING_CONTRACT: join by Customer_ID + Material_ID; no match = finding
    # ------------------------------------------------------------------
    def test_missing_contract_no_match(self):
        denial = {"Customer_ID": "CUST-99", "Material_ID": "MAT-99"}
        source = pd.DataFrame(
            [{"Customer_ID": "CUST-1", "Material_ID": "MAT-1", "Contract_ID": "CON-1"}]
        )
        sc = _scenario("MISSING_CONTRACT", "contracts_data", ["Customer_ID", "Material_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "no_match"

    def test_missing_contract_found(self):
        denial = {"Customer_ID": "CUST-1", "Material_ID": "MAT-1"}
        source = pd.DataFrame(
            [{"Customer_ID": "CUST-1", "Material_ID": "MAT-1", "Contract_ID": "CON-1"}]
        )
        sc = _scenario("MISSING_CONTRACT", "contracts_data", ["Customer_ID", "Material_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "ok"

    # ------------------------------------------------------------------
    # PRICE_VARIANCE: join by Contract_ID + Material_ID + Customer_ID
    # ------------------------------------------------------------------
    def test_price_variance_match(self):
        denial = {"Contract_ID": "CON-1", "Material_ID": "MAT-1", "Customer_ID": "CUST-1"}
        source = pd.DataFrame(
            [{"Contract_ID": "CON-1", "Material_ID": "MAT-1", "Customer_ID": "CUST-1", "Price": "50.00"}]
        )
        sc = _scenario("PRICE_VARIANCE", "pricing_data", ["Contract_ID", "Material_ID", "Customer_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "ok"
        assert result.matched_row["Price"] == "50.00"

    # ------------------------------------------------------------------
    # Blank join key on denial side → no match
    # ------------------------------------------------------------------
    def test_blank_denial_key_yields_no_match(self):
        denial = {"Material_ID": ""}
        source = pd.DataFrame([{"Material_ID": "MAT-1"}])
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"])
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "no_match"

    # ------------------------------------------------------------------
    # Duplicate match strategy = first
    # ------------------------------------------------------------------
    def test_first_strategy_returns_ok(self):
        denial = {"Material_ID": "MAT-1"}
        source = pd.DataFrame(
            [
                {"Material_ID": "MAT-1", "Type": "A"},
                {"Material_ID": "MAT-1", "Type": "B"},
            ]
        )
        sc = ScenarioConfig(
            scenario_name="MAT_ATTR_MISMATCH",
            primary_source="material_master",
            join_keys=["Material_ID"],
            duplicate_match_strategy="first",
        )
        result = join_denial_to_source(denial, source, sc)
        assert result.status == "ok"
        assert result.matched_row["Type"] == "A"


class TestJoinWithFallbackKeys:
    def test_falls_back_to_secondary_keys(self):
        denial = {"Material_ID": "UNKNOWN", "NDC": "12345"}
        source = pd.DataFrame([{"Material_ID": "MAT-1", "NDC": "12345"}])
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"], secondary=["NDC"])
        result = join_with_fallback_keys(denial, source, sc)
        assert result.status == "ok"
        assert result.matched_row["NDC"] == "12345"

    def test_conflicting_secondary_key_requires_manual_review(self):
        denial = {"Material_ID": "MAT-1", "NDC": "99999"}
        source = pd.DataFrame([{"Material_ID": "MAT-1", "NDC": "12345"}])
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"], secondary=["NDC"])
        result = join_with_fallback_keys(denial, source, sc)
        assert result.status == "conflict"

    def test_no_secondary_keys_returns_no_match(self):
        denial = {"Material_ID": "UNKNOWN"}
        source = pd.DataFrame([{"Material_ID": "MAT-1"}])
        sc = _scenario("MAT_ATTR_MISMATCH", "material_master", ["Material_ID"])
        result = join_with_fallback_keys(denial, source, sc)
        assert result.status == "no_match"
