"""Tests for processor.py edge cases that affect final row classifications."""

from __future__ import annotations

import pandas as pd

from app.data_sources import InMemoryDataSource
from app.file_registry import FileRegistry
from app.processor import process_claims
from app.schemas import ScenarioConfig
from tests.conftest import make_brain


def test_missing_source_uses_primary_source_fallback_label(sample_denial_df):
    brain = make_brain(
        scenarios={
            "MAT_ATTR_MISMATCH": ScenarioConfig(
                scenario_name="MAT_ATTR_MISMATCH",
                primary_source="material_master",
                join_keys=["Material_ID"],
                default_agent_status_no_match="Data Missing",
            )
        }
    )
    registry = FileRegistry(
        {"denial_records": InMemoryDataSource("denial_records", sample_denial_df)}
    )

    rows = process_claims(brain, registry)

    assert len(rows) == 1
    assert rows[0]["Primary_Source_Checked"] == "Material Master"
    assert rows[0]["Agent_Status"] == "Data Missing"
    assert rows[0]["Research_Finding"] == "Source 'material_master' is not available."


def test_duplicate_match_without_display_label_stays_user_facing(sample_denial_df):
    brain = make_brain(
        scenarios={
            "MAT_ATTR_MISMATCH": ScenarioConfig(
                scenario_name="MAT_ATTR_MISMATCH",
                primary_source="material_master",
                join_keys=["Material_ID"],
                duplicate_match_strategy="manual_review",
            )
        }
    )
    registry = FileRegistry(
        {
            "denial_records": InMemoryDataSource("denial_records", sample_denial_df),
            "material_master": InMemoryDataSource(
                "material_master",
                pd.DataFrame(
                    [
                        {"Material_ID": "MAT-1", "Material_Type": "Branded"},
                        {"Material_ID": "MAT-1", "Material_Type": "Generic"},
                    ]
                ),
            ),
        }
    )

    rows = process_claims(brain, registry)

    assert len(rows) == 1
    assert rows[0]["Primary_Source_Checked"] == "Material Master"
    assert rows[0]["Agent_Status"] == "Needs Manual Review"
    assert "Duplicate matching source records found" in rows[0]["Research_Finding"]


def test_conflicting_join_keys_become_manual_review(sample_denial_df):
    brain = make_brain(
        scenarios={
            "MAT_ATTR_MISMATCH": ScenarioConfig(
                scenario_name="MAT_ATTR_MISMATCH",
                primary_source="material_master",
                join_keys=["Material_ID"],
                secondary_join_keys=["NDC"],
            )
        }
    )
    registry = FileRegistry(
        {
            "denial_records": InMemoryDataSource("denial_records", sample_denial_df),
            "material_master": InMemoryDataSource(
                "material_master",
                pd.DataFrame([{"Material_ID": "MAT-1", "NDC": "DIFFERENT"}]),
            ),
        }
    )

    rows = process_claims(brain, registry)

    assert len(rows) == 1
    assert rows[0]["Agent_Status"] == "Needs Manual Review"
    assert "Conflicting identifier values" in rows[0]["Research_Finding"]
