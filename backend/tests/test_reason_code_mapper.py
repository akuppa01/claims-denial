"""Tests for reason_code_mapper.py."""

from __future__ import annotations

import pytest

from app.reason_code_mapper import ReasonCodeMapper, build_normalised_index, resolve_reason_code
from app.schemas import RulesBrain, ScenarioConfig, OutputDefaults
from app.rules_loader import DEFAULT_OUTPUT_COLUMNS


def _make_brain_with_scenarios(*scenario_names: str) -> RulesBrain:
    scenarios = {
        name: ScenarioConfig(
            scenario_name=name,
            primary_source="denial_records",
            join_keys=[],
        )
        for name in scenario_names
    }
    return RulesBrain(
        scenarios=scenarios,
        output_defaults=OutputDefaults(),
        output_columns=DEFAULT_OUTPUT_COLUMNS[:],
    )


class TestNormalisedIndex:
    def test_canonical_maps_to_itself(self):
        index = build_normalised_index({}, {"PRICE_VARIANCE"})
        assert index["price_variance"] == ["PRICE_VARIANCE"]

    def test_explicit_variant_maps_to_canonical(self):
        index = build_normalised_index({"price_variance": "PRICE_VARIANCE"}, {"PRICE_VARIANCE"})
        assert "price_variance" in index
        assert "PRICE_VARIANCE" in index["price_variance"]

    def test_space_and_hyphen_variants_normalised(self):
        index = build_normalised_index(
            {"Price Variance": "PRICE_VARIANCE", "price-variance": "PRICE_VARIANCE"},
            {"PRICE_VARIANCE"},
        )
        # "Price Variance" normalises to "price_variance"
        # "price-variance" also normalises to "price_variance"
        assert "PRICE_VARIANCE" in index["price_variance"]


class TestResolveReasonCode:
    def test_exact_canonical_resolves_ok(self):
        index = build_normalised_index({}, {"PRICE_VARIANCE"})
        code, hint = resolve_reason_code("PRICE_VARIANCE", index)
        assert code == "PRICE_VARIANCE"
        assert hint == "ok"

    def test_lowercase_resolves_ok(self):
        index = build_normalised_index({}, {"PRICE_VARIANCE"})
        code, hint = resolve_reason_code("price_variance", index)
        assert code == "PRICE_VARIANCE"
        assert hint == "ok"

    def test_spaced_variant_resolves_ok(self):
        index = build_normalised_index({"Price Variance": "PRICE_VARIANCE"}, {"PRICE_VARIANCE"})
        code, hint = resolve_reason_code("Price Variance", index)
        assert code == "PRICE_VARIANCE"
        assert hint == "ok"

    def test_hyphenated_variant_resolves_ok(self):
        index = build_normalised_index({"price-variance": "PRICE_VARIANCE"}, {"PRICE_VARIANCE"})
        code, hint = resolve_reason_code("price-variance", index)
        assert code == "PRICE_VARIANCE"
        assert hint == "ok"

    def test_unknown_code_returns_unknown(self):
        index = build_normalised_index({}, {"PRICE_VARIANCE"})
        code, hint = resolve_reason_code("TOTALLY_UNKNOWN", index)
        assert code is None
        assert hint == "unknown"

    def test_ambiguous_code_returns_ambiguous(self):
        # "price_variance" normalises to same key as "PRICE_VARIANCE" which
        # already maps to itself; force a real ambiguity by injecting two
        # different canonicals for the same normalised key
        index = {"price_variance": ["PRICE_VARIANCE", "CONTRACT_MISMATCH"]}
        code, hint = resolve_reason_code("price_variance", index)
        assert code is None
        assert hint == "ambiguous"


class TestReasonCodeMapper:
    def test_mapper_resolves_known_codes(self):
        brain = _make_brain_with_scenarios("MAT_ATTR_MISMATCH", "PRICE_VARIANCE")
        mapper = ReasonCodeMapper(brain)
        code, hint = mapper.resolve("MAT_ATTR_MISMATCH")
        assert code == "MAT_ATTR_MISMATCH"
        assert hint == "ok"

    def test_mapper_handles_case_variants(self):
        brain = _make_brain_with_scenarios("CUST_ELIGIBILITY")
        mapper = ReasonCodeMapper(brain)
        code, hint = mapper.resolve("cust_eligibility")
        assert code == "CUST_ELIGIBILITY"
        assert hint == "ok"

    def test_mapper_unknown_returns_none(self):
        brain = _make_brain_with_scenarios("PRICE_VARIANCE")
        mapper = ReasonCodeMapper(brain)
        code, hint = mapper.resolve("GHOST_CODE")
        assert code is None
        assert hint == "unknown"
