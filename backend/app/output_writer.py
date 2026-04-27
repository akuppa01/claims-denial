"""Output writer.

Assembles the final list of processed row dicts into a pandas DataFrame,
enforces the canonical output column order, fills in defaults, and writes
the result to an in-memory Excel workbook via openpyxl (delegating styling
to excel_styler).

Column order and output defaults are read from the parsed RulesBrain so they
can be changed through the Output_Template / Output_Defaults sheets without
touching Python code.
"""

from __future__ import annotations

import io
from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd

from .excel_styler import style_workbook
from .schemas import OutputDefaults, RulesBrain

CENTRAL = ZoneInfo("America/Chicago")


def _make_timestamp() -> str:
    """Return current US Central time with explicit UTC offset, e.g.
    '2026-04-26 17:45:12 CDT (UTC-05:00)'
    """
    now = datetime.now(tz=CENTRAL)
    # strftime %Z gives the abbreviation (CDT / CST)
    abbrev = now.strftime("%Z")
    # UTC offset as ±HH:MM
    offset_seconds = int(now.utcoffset().total_seconds())
    sign = "+" if offset_seconds >= 0 else "-"
    abs_sec = abs(offset_seconds)
    hh, mm = divmod(abs_sec // 60, 60)
    offset_str = f"UTC{sign}{hh:02d}:{mm:02d}"
    return now.strftime(f"%Y-%m-%d %H:%M:%S") + f" {abbrev} ({offset_str})"


def _apply_output_defaults(row: dict, defaults: OutputDefaults) -> dict:
    """Fill default output values if not already set by the processing pipeline."""
    row.setdefault("ECC_Update_Type", defaults.ecc_update_type)
    row.setdefault("Financial_Posting_Allowed", defaults.financial_posting_allowed)
    row.setdefault("Pricing_Change_Allowed", defaults.pricing_change_allowed)
    return row


def build_output_dataframe(
    processed_rows: list[dict],
    brain: RulesBrain,
) -> pd.DataFrame:
    """Convert processed rows into a DataFrame with canonical column order."""
    timestamp = _make_timestamp()
    output_columns = brain.output_columns
    defaults = brain.output_defaults

    normalised: list[dict] = []
    for row in processed_rows:
        out = _apply_output_defaults(dict(row), defaults)
        out["Processed_Timestamp"] = timestamp
        # Build ordered dict matching the output template exactly
        ordered = {col: out.get(col, "") for col in output_columns}
        normalised.append(ordered)

    if not normalised:
        return pd.DataFrame(columns=output_columns)

    return pd.DataFrame(normalised, columns=output_columns)


def write_output_excel(
    processed_rows: list[dict],
    brain: RulesBrain,
) -> bytes:
    """Return the output Excel file as raw bytes (in-memory, no disk write)."""
    df = build_output_dataframe(processed_rows, brain)
    buf = io.BytesIO()
    # Write via openpyxl engine so we can apply styling afterwards
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Results")
        workbook = writer.book
        worksheet = writer.sheets["Results"]
        style_workbook(workbook, worksheet, df)
    buf.seek(0)
    return buf.read()
