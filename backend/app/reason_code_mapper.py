"""Reason code normaliser.

Normalisation steps (in order):
  1. Strip surrounding whitespace.
  2. Lowercase.
  3. Replace spaces and hyphens with underscores.
  4. Collapse consecutive underscores.

The normalised form is used to look up the canonical code from the rules
brain Reason_Code_Map.  If the lookup produces exactly one canonical code,
that code is returned.  If normalisation is ambiguous (the same normalised
key maps to multiple canonicals) or the code is unknown, the caller receives
None and should mark the record as Needs Manual Review.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple

from .schemas import RulesBrain


def _normalise(raw: str) -> str:
    """Produce a stable, lowercase slug for a raw reason code string."""
    s = raw.strip().lower()
    s = re.sub(r"[\s\-]+", "_", s)
    s = re.sub(r"_+", "_", s)
    return s


def build_normalised_index(
    reason_code_map: dict[str, str],
    scenario_names: set[str],
) -> dict[str, list[str]]:
    """
    Return {normalised_variant: [canonical_code, ...]} built from the rules
    brain map plus the canonical codes themselves (a code is always its own
    valid variant).
    """
    index: dict[str, list[str]] = {}

    # Each canonical code maps to itself
    for canonical in scenario_names:
        key = _normalise(canonical)
        index.setdefault(key, [])
        if canonical not in index[key]:
            index[key].append(canonical)

    # Explicit variants from the rules brain
    for variant, canonical in reason_code_map.items():
        key = _normalise(variant)
        index.setdefault(key, [])
        if canonical not in index[key]:
            index[key].append(canonical)

    return index


def resolve_reason_code(
    raw: str,
    normalised_index: dict,
) -> Tuple[Optional[str], str]:
    """
    Attempt to resolve *raw* to a canonical reason code.

    Returns:
        (canonical_code, status_hint) where status_hint is one of:
          "ok"          – resolved unambiguously
          "ambiguous"   – normalised form matches multiple canonicals
          "unknown"     – no matching canonical found
    """
    key = _normalise(raw)
    matches = normalised_index.get(key, [])

    if len(matches) == 1:
        return matches[0], "ok"
    if len(matches) > 1:
        return None, "ambiguous"
    return None, "unknown"


class ReasonCodeMapper:
    """Stateful mapper bound to a parsed RulesBrain config."""

    def __init__(self, brain: RulesBrain) -> None:
        scenario_names = set(brain.scenarios.keys())
        self._index = build_normalised_index(brain.reason_code_map, scenario_names)

    def resolve(self, raw: str) -> Tuple[Optional[str], str]:
        """See resolve_reason_code for return semantics."""
        return resolve_reason_code(raw, self._index)
