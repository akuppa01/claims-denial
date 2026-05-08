"""Integration tests for the FastAPI upload/download boundary."""

from __future__ import annotations

import io

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from tests.test_rules_loader import _make_workbook, _minimal_sheets


def _xlsx_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    buf.seek(0)
    return buf.read()


def _sample_uploads() -> dict[str, tuple[str, bytes, str]]:
    excel_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return {
        "denial_records": (
            "DenialRecords_Populated.xlsx",
            _xlsx_bytes(
                pd.DataFrame(
                    [
                        {
                            "Claim_ID": "CLM001",
                            "Denial_ID": "DEN001",
                            "Reason_Code": "MAT_ATTR_MISMATCH",
                            "Material_ID": "MAT-1",
                            "NDC": "12345-678-90",
                            "Customer_ID": "CUST-1",
                            "Contract_ID": "CON-1",
                        }
                    ]
                )
            ),
            excel_type,
        ),
        "contracts_data": (
            "ContractsData_Populated.xlsx",
            _xlsx_bytes(
                pd.DataFrame(
                    [
                        {
                            "Contract_ID": "CON-1",
                            "Customer_ID": "CUST-1",
                            "Material_ID": "MAT-1",
                            "Contract_Price": "100.00",
                        }
                    ]
                )
            ),
            excel_type,
        ),
        "customer_master": (
            "CustomerMasterRecords_Populated.xlsx",
            _xlsx_bytes(pd.DataFrame([{"Customer_ID": "CUST-1", "Eligible": "Yes"}])),
            excel_type,
        ),
        "material_master": (
            "MaterialMasterRecords_Populated.xlsx",
            _xlsx_bytes(
                pd.DataFrame(
                    [{"Material_ID": "MAT-1", "NDC": "12345-678-90", "Material_Type": "Branded"}]
                )
            ),
            excel_type,
        ),
        "pricing_data": (
            "PricingData_Populated.xlsx",
            _xlsx_bytes(
                pd.DataFrame(
                    [
                        {
                            "Contract_ID": "CON-1",
                            "Customer_ID": "CUST-1",
                            "Material_ID": "MAT-1",
                            "Price": "100.00",
                        }
                    ]
                )
            ),
            excel_type,
        ),
        "rules_brain": (
            "Claims_AI_Rules_Brain.xlsx",
            _make_workbook(_minimal_sheets()),
            excel_type,
        ),
    }


def test_process_claims_returns_rows_and_download_url():
    client = TestClient(app)

    response = client.post("/process-claims", files=_sample_uploads())

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"

    payload = response.json()
    assert isinstance(payload["rows"], list)
    assert payload["rows"][0]["claimId"] == "CLM001"
    assert payload["download_url"].startswith("/download-output/")

    download_response = client.get(payload["download_url"])
    assert download_response.status_code == 200
    assert download_response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert download_response.headers["content-disposition"] == (
        'attachment; filename="OutputFile_Generated.xlsx"'
    )
    assert download_response.content[:2] == b"PK"


def test_process_claims_preflight_allows_vite_origin():
    client = TestClient(app)

    response = client.options(
        "/process-claims",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
