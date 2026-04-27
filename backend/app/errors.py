"""Custom exception hierarchy for the claims denial backend."""


class ClaimsBackendError(Exception):
    """Base error for all claims backend failures."""


class MissingUploadedFileError(ClaimsBackendError):
    """A required multipart file was not included in the request."""

    def __init__(self, field_name: str):
        super().__init__(f"Required uploaded file is missing: '{field_name}'")
        self.field_name = field_name


class MissingRulesBrainSheetError(ClaimsBackendError):
    """A required sheet was not found in the rules brain workbook."""

    def __init__(self, sheet_name: str):
        super().__init__(f"Required rules brain sheet is missing: '{sheet_name}'")
        self.sheet_name = sheet_name


class MissingSourceColumnError(ClaimsBackendError):
    """A required canonical column was absent from a source DataFrame after alias mapping."""

    def __init__(self, column: str, source: str):
        super().__init__(
            f"Required column '{column}' not found in source '{source}' after alias mapping"
        )
        self.column = column
        self.source = source


class InvalidRulesBrainError(ClaimsBackendError):
    """The rules brain file has an unrecoverable structural problem."""


class RowProcessingError(ClaimsBackendError):
    """Non-fatal error for a single row; logged and row is marked appropriately."""
