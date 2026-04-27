"""FastAPI application entry point.

Endpoints
---------
GET  /health          – liveness check
POST /process-claims  – main processing endpoint

Multipart form fields:
  denial_records  – DenialRecords_Populated.xlsx
  contracts_data  – ContractsData_Populated.xlsx
  customer_master – CustomerMasterRecords_Populated.xlsx
  material_master – MaterialMasterRecords_Populated.xlsx
  pricing_data    – PricingData_Populated.xlsx
  rules_brain     – Claims_AI_Rules_Brain.xlsx
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response

from .errors import (
    ClaimsBackendError,
    MissingRulesBrainSheetError,
    MissingSourceColumnError,
    MissingUploadedFileError,
)
from .file_registry import build_registry_from_uploads
from .output_writer import write_output_excel
from .processor import process_claims
from .rules_loader import load_rules_brain

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(
    title="Claims Denial Validation API",
    description=(
        "Config-driven backend for validating insurance claims denials. "
        "All business rules are controlled by the uploaded rules brain Excel file."
    ),
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Process claims
# ---------------------------------------------------------------------------


@app.post("/process-claims")
async def process_claims_endpoint(
    denial_records: UploadFile = File(..., description="DenialRecords Excel file"),
    contracts_data: UploadFile = File(..., description="ContractsData Excel file"),
    customer_master: UploadFile = File(..., description="CustomerMasterRecords Excel file"),
    material_master: UploadFile = File(..., description="MaterialMasterRecords Excel file"),
    pricing_data: UploadFile = File(..., description="PricingData Excel file"),
    rules_brain: UploadFile = File(..., description="Claims_AI_Rules_Brain Excel file"),
) -> Response:
    try:
        # Read all uploaded bytes eagerly so we can give clear errors
        denial_bytes = await denial_records.read()
        contracts_bytes = await contracts_data.read()
        customer_bytes = await customer_master.read()
        material_bytes = await material_master.read()
        pricing_bytes = await pricing_data.read()
        brain_bytes = await rules_brain.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded files: {exc}")

    # Validate all required uploads are non-empty
    uploads = {
        "denial_records": denial_bytes,
        "contracts_data": contracts_bytes,
        "customer_master": customer_bytes,
        "material_master": material_bytes,
        "pricing_data": pricing_bytes,
        "rules_brain": brain_bytes,
    }
    for field_name, content in uploads.items():
        if not content:
            raise HTTPException(
                status_code=400,
                detail=f"Required uploaded file '{field_name}' is empty or missing.",
            )

    # Parse rules brain
    try:
        brain = load_rules_brain(brain_bytes)
    except MissingRulesBrainSheetError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        log.exception("Failed to parse rules brain")
        raise HTTPException(status_code=400, detail=f"Rules brain parsing failed: {exc}")

    # Build file registry
    try:
        registry = build_registry_from_uploads(
            denial_records=denial_bytes,
            contracts_data=contracts_bytes,
            customer_master=customer_bytes,
            material_master=material_bytes,
            pricing_data=pricing_bytes,
        )
    except MissingUploadedFileError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Process
    try:
        processed_rows = process_claims(brain, registry)
    except MissingSourceColumnError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        log.exception("Processing pipeline failed")
        raise HTTPException(status_code=500, detail=f"Processing error: {exc}")

    # Write output Excel
    try:
        excel_bytes = write_output_excel(processed_rows, brain)
    except Exception as exc:
        log.exception("Output generation failed")
        raise HTTPException(status_code=500, detail=f"Output generation error: {exc}")

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=OutputFile_Generated.xlsx"},
    )
