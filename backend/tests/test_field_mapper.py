"""Tests for field_mapper.py — alias resolution and column normalisation."""

from __future__ import annotations

import pandas as pd
import pytest

from app.errors import MissingSourceColumnError
from app.field_mapper import apply_aliases, assert_required_columns, build_alias_index
from app.schemas import FieldAlias


def _make_aliases(*entries: tuple[str, str, str]) -> list[FieldAlias]:
    return [FieldAlias(canonical_name=c, source=s, raw_name=r) for c, s, r in entries]


class TestBuildAliasIndex:
    def test_basic_index_structure(self):
        aliases = _make_aliases(
            ("Claim_ID", "denial_records", "claim_id"),
            ("Claim_ID", "denial_records", "ClaimID"),
        )
        index = build_alias_index(aliases)
        assert "denial_records" in index
        assert index["denial_records"]["claim_id"] == "Claim_ID"
        assert index["denial_records"]["claimid"] == "Claim_ID"

    def test_multiple_sources(self):
        aliases = _make_aliases(
            ("Material_ID", "denial_records", "mat_id"),
            ("Material_ID", "material_master", "MaterialID"),
        )
        index = build_alias_index(aliases)
        assert index["denial_records"]["mat_id"] == "Material_ID"
        assert index["material_master"]["materialid"] == "Material_ID"


class TestApplyAliases:
    def test_renames_known_column(self):
        aliases = _make_aliases(("Claim_ID", "denial_records", "claim_id"))
        index = build_alias_index(aliases)
        df = pd.DataFrame([{"claim_id": "C1"}])
        result = apply_aliases(df, "denial_records", index)
        assert "Claim_ID" in result.columns
        assert "claim_id" not in result.columns

    def test_leaves_unknown_column_unchanged(self):
        aliases = _make_aliases(("Claim_ID", "denial_records", "claim_id"))
        index = build_alias_index(aliases)
        df = pd.DataFrame([{"claim_id": "C1", "extra_col": "X"}])
        result = apply_aliases(df, "denial_records", index)
        assert "extra_col" in result.columns

    def test_case_insensitive_match(self):
        aliases = _make_aliases(("Denial_ID", "denial_records", "Denial_ID"))
        index = build_alias_index(aliases)
        df = pd.DataFrame([{"denial_id": "D1"}])
        result = apply_aliases(df, "denial_records", index)
        assert "Denial_ID" in result.columns

    def test_no_aliases_for_source_leaves_df_unchanged(self):
        index: dict = {}
        df = pd.DataFrame([{"col_a": 1}])
        result = apply_aliases(df, "some_source", index)
        assert list(result.columns) == ["col_a"]


class TestAssertRequiredColumns:
    def test_passes_when_all_present(self):
        df = pd.DataFrame([{"Claim_ID": "C1", "Denial_ID": "D1"}])
        assert_required_columns(df, ["Claim_ID", "Denial_ID"], "denial_records")

    def test_raises_on_missing(self):
        df = pd.DataFrame([{"Claim_ID": "C1"}])
        with pytest.raises(MissingSourceColumnError) as exc_info:
            assert_required_columns(df, ["Claim_ID", "Denial_ID"], "denial_records")
        assert "Denial_ID" in str(exc_info.value)
