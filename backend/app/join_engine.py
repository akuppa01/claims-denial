"""Join engine.

Joins a single denial record (as a dict) against a source DataFrame using
keys defined in the ScenarioConfig.

Return contract:
    JoinResult.rows     – list of matching dicts (empty means no match)
    JoinResult.status   – "ok" | "no_match" | "duplicate"

The caller decides what to do with duplicates; this module only detects them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import pandas as pd

from .schemas import ScenarioConfig


@dataclass
class JoinResult:
    rows: List[dict] = field(default_factory=list)
    status: str = "ok"      # "ok" | "no_match" | "duplicate" | "conflict"

    @property
    def matched_row(self) -> Optional[dict]:
        return self.rows[0] if self.rows else None


def _safe_str(val) -> str:
    if pd.isna(val):
        return ""
    return str(val).strip()


def _build_filter(
    source_df: pd.DataFrame,
    denial_row: dict,
    join_keys: list[str],
) -> pd.Series:
    """Build a boolean mask for rows in source_df that match all join keys."""
    mask = pd.Series([True] * len(source_df), index=source_df.index)
    for key in join_keys:
        if key not in source_df.columns:
            # Column absent from source — no rows can match on this key
            return pd.Series([False] * len(source_df), index=source_df.index)
        denial_val = _safe_str(denial_row.get(key, ""))
        if not denial_val:
            # Blank join key on denial side — cannot match
            return pd.Series([False] * len(source_df), index=source_df.index)
        source_vals = source_df[key].apply(_safe_str)
        mask = mask & (source_vals == denial_val)
    return mask


def join_denial_to_source(
    denial_row: dict,
    source_df: pd.DataFrame,
    scenario: ScenarioConfig,
) -> JoinResult:
    """Attempt to match one denial record against source using scenario join keys.

    For MISSING_CONTRACT the join is expected to return no rows; the caller
    treats that as the meaningful result (contract is indeed missing).
    """
    keys = scenario.join_keys
    if not keys:
        return JoinResult(status="no_match")

    mask = _build_filter(source_df, denial_row, keys)
    matched = source_df[mask]

    if matched.empty:
        return JoinResult(status="no_match")

    rows = matched.to_dict(orient="records")
    if len(rows) == 1:
        return JoinResult(rows=rows, status="ok")

    # Multiple matches — let the caller decide via Duplicate_Match_Strategy
    if scenario.duplicate_match_strategy.lower() == "first":
        return JoinResult(rows=[rows[0]], status="ok")

    return JoinResult(rows=rows, status="duplicate")


def join_with_fallback_keys(
    denial_row: dict,
    source_df: pd.DataFrame,
    scenario: ScenarioConfig,
) -> JoinResult:
    """Try primary join keys first; if no match, attempt secondary join keys.

    Used by scenarios such as MAT_ATTR_MISMATCH where the join can fall back
    from Material_ID to NDC.
    """
    result = join_denial_to_source(denial_row, source_df, scenario)
    if result.status == "ok" and result.matched_row and scenario.secondary_join_keys:
        for key in scenario.secondary_join_keys:
            denial_val = _safe_str(denial_row.get(key, ""))
            source_val = _safe_str(result.matched_row.get(key, ""))
            if denial_val and source_val and denial_val != source_val:
                return JoinResult(rows=result.rows, status="conflict")
    if result.status != "no_match":
        return result

    if scenario.secondary_join_keys:
        fallback_scenario = ScenarioConfig(
            scenario_name=scenario.scenario_name,
            primary_source=scenario.primary_source,
            join_keys=scenario.secondary_join_keys,
            duplicate_match_strategy=scenario.duplicate_match_strategy,
            default_agent_status_no_match=scenario.default_agent_status_no_match,
        )
        return join_denial_to_source(denial_row, source_df, fallback_scenario)

    return result
