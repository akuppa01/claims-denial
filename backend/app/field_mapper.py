"""Field alias mapper.

Translates raw column names in each source DataFrame to canonical names
defined in the rules brain Field_Aliases sheet.

Canonical names are used everywhere internally so the rest of the pipeline
is independent of how source files happen to name their columns.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import pandas as pd

from .errors import MissingSourceColumnError
from .schemas import FieldAlias


def build_alias_index(
    field_aliases: list[FieldAlias],
) -> dict[str, dict[str, str]]:
    """Return {source_key: {raw_name_lower: canonical_name}} for fast lookup."""
    index: dict[str, dict[str, str]] = {}
    for fa in field_aliases:
        source = fa.source.strip()
        raw_lower = fa.raw_name.strip().lower()
        index.setdefault(source, {})[raw_lower] = fa.canonical_name
    return index


def apply_aliases(
    df: pd.DataFrame,
    source_key: str,
    alias_index: dict[str, dict[str, str]],
) -> pd.DataFrame:
    """Rename raw columns to canonical names for the given source.

    Columns not found in the alias index are kept under their original name
    (they are simply not aliased).  The caller is responsible for asserting
    that required canonical columns are present after this step.
    """
    source_map = alias_index.get(source_key, {})
    rename_map: dict[str, str] = {}
    for col in df.columns:
        canonical = source_map.get(col.strip().lower())
        if canonical:
            rename_map[col] = canonical
    return df.rename(columns=rename_map)


def assert_required_columns(
    df: pd.DataFrame,
    required: list[str],
    source_key: str,
) -> None:
    """Raise MissingSourceColumnError if any required canonical column is absent."""
    for col in required:
        if col not in df.columns:
            raise MissingSourceColumnError(col, source_key)


def get_canonical_df(
    df: pd.DataFrame,
    source_key: str,
    alias_index: Dict[str, Dict[str, str]],
    required_columns: Optional[List[str]] = None,
) -> pd.DataFrame:
    """Apply alias mapping and optionally assert required columns exist."""
    df = apply_aliases(df, source_key, alias_index)
    if required_columns:
        assert_required_columns(df, required_columns, source_key)
    return df
