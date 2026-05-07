"""DataSource abstraction.

Current implementation: ExcelDataSource.
Future: ApiDataSource, DatabaseDataSource, CsvDataSource — each implements
the same interface so the join/validation engines are source-agnostic.
"""

from __future__ import annotations

import io
from abc import ABC, abstractmethod
from typing import Optional, Union

import pandas as pd


class DataSource(ABC):
    """Abstract source of tabular data."""

    @abstractmethod
    def get_dataframe(self) -> pd.DataFrame:
        """Return the data as a pandas DataFrame."""

    @property
    @abstractmethod
    def source_key(self) -> str:
        """Stable identifier used in the rules brain (e.g. 'contracts_data')."""


class ExcelDataSource(DataSource):
    """DataSource backed by an uploaded Excel file (bytes or file-like object)."""

    def __init__(
        self,
        key: str,
        file_bytes: Union[bytes, io.IOBase],
        sheet_name: Union[int, str] = 0,
    ) -> None:
        self._key = key
        self._file_bytes = file_bytes
        self._sheet_name = sheet_name
        self._df: Optional[pd.DataFrame] = None

    @property
    def source_key(self) -> str:
        return self._key

    def get_dataframe(self) -> pd.DataFrame:
        if self._df is None:
            if isinstance(self._file_bytes, (bytes, bytearray)):
                buf = io.BytesIO(self._file_bytes)
            else:
                buf = self._file_bytes
            self._df = pd.read_excel(buf, sheet_name=self._sheet_name, dtype=str, engine="openpyxl")
            self._df.columns = [str(c).strip() for c in self._df.columns]
        return self._df.copy()


class InMemoryDataSource(DataSource):
    """DataSource backed by an existing DataFrame — used in tests."""

    def __init__(self, key: str, df: pd.DataFrame) -> None:
        self._key = key
        self._df = df

    @property
    def source_key(self) -> str:
        return self._key

    def get_dataframe(self) -> pd.DataFrame:
        return self._df.copy()
