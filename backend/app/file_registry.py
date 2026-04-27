"""Registry mapping multipart form field names to DataSource instances.

The registry validates that all required uploads are present and provides
a single lookup point for the rest of the pipeline.
"""

from __future__ import annotations

from .data_sources import DataSource, ExcelDataSource
from .errors import MissingUploadedFileError

# Canonical keys the rest of the backend uses to refer to each source
REQUIRED_SOURCES = [
    "denial_records",
    "contracts_data",
    "customer_master",
    "material_master",
    "pricing_data",
]


class FileRegistry:
    """Holds DataSource instances keyed by their canonical source key."""

    def __init__(self, sources: dict[str, DataSource]) -> None:
        self._sources = sources

    def get(self, key: str) -> DataSource:
        if key not in self._sources:
            raise MissingUploadedFileError(key)
        return self._sources[key]

    def keys(self) -> list[str]:
        return list(self._sources.keys())


def build_registry_from_uploads(
    denial_records: bytes,
    contracts_data: bytes,
    customer_master: bytes,
    material_master: bytes,
    pricing_data: bytes,
) -> FileRegistry:
    """Construct a FileRegistry from raw upload bytes, validating all are present."""
    mapping = {
        "denial_records": denial_records,
        "contracts_data": contracts_data,
        "customer_master": customer_master,
        "material_master": material_master,
        "pricing_data": pricing_data,
    }
    for key, val in mapping.items():
        if val is None or len(val) == 0:
            raise MissingUploadedFileError(key)

    sources: dict[str, DataSource] = {
        key: ExcelDataSource(key=key, file_bytes=val)
        for key, val in mapping.items()
    }
    return FileRegistry(sources)
