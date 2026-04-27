# Claims Denial Validation Backend

Config-driven FastAPI backend for validating insurance claims denials.
All business rules, join logic, field aliases, and output formats are
controlled by the uploaded **Rules Brain** Excel file — not hardcoded in Python.

---

## Architecture overview

```
backend/
  app/
    main.py               – FastAPI app, endpoints
    processor.py          – End-to-end orchestration pipeline
    data_sources.py       – DataSource abstraction (Excel / future API / DB)
    file_registry.py      – Registry of uploaded source files
    rules_loader.py       – Parse rules brain workbook → RulesBrain config
    field_mapper.py       – Map raw column names to canonical names
    reason_code_mapper.py – Normalise and resolve reason codes
    join_engine.py        – Join denial records to source data
    validation_engine.py  – Evaluate validation rules (operators)
    output_writer.py      – Assemble output DataFrame + write Excel
    excel_styler.py       – Apply openpyxl formatting/colours
    errors.py             – Custom exception hierarchy
    schemas.py            – Pydantic config models
  tests/
    conftest.py           – Shared fixtures
    test_rules_loader.py
    test_field_mapper.py
    test_reason_code_mapper.py
    test_join_engine.py
    test_validation_engine.py
    test_output_writer.py
  requirements.txt
  README.md
```

---

## Running locally

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the server

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

---

## Running tests

```bash
cd backend
pytest tests/ -v
```

---

## Calling the endpoint

### Health check

```bash
curl http://localhost:8000/health
```

### Process claims (multipart upload)

```bash
curl -X POST http://localhost:8000/process-claims \
  -F "denial_records=@DenialRecords_Populated.xlsx" \
  -F "contracts_data=@ContractsData_Populated.xlsx" \
  -F "customer_master=@CustomerMasterRecords_Populated.xlsx" \
  -F "material_master=@MaterialMasterRecords_Populated.xlsx" \
  -F "pricing_data=@PricingData_Populated.xlsx" \
  -F "rules_brain=@Claims_AI_Rules_Brain.xlsx" \
  --output OutputFile_Generated.xlsx
```

The response is a binary Excel file saved to `OutputFile_Generated.xlsx`.

---

## Expected uploaded files

| Form field        | File                                 | Description                         |
|-------------------|--------------------------------------|-------------------------------------|
| `denial_records`  | `DenialRecords_Populated.xlsx`       | Denial records to process           |
| `contracts_data`  | `ContractsData_Populated.xlsx`       | Contract master data                |
| `customer_master` | `CustomerMasterRecords_Populated.xlsx` | Customer eligibility records      |
| `material_master` | `MaterialMasterRecords_Populated.xlsx` | Material/NDC master records        |
| `pricing_data`    | `PricingData_Populated.xlsx`         | Pricing schedules                   |
| `rules_brain`     | `Claims_AI_Rules_Brain.xlsx`         | **Central config — controls all rules** |

---

## Rules Brain sheet reference

All sheets use the first row as column headers.

### `Field_Aliases` (required)

Maps raw source column names to internal canonical names.

| Column           | Description                                           |
|------------------|-------------------------------------------------------|
| `canonical_name` | Internal field name used throughout the pipeline      |
| `source`         | Source key: `denial_records`, `contracts_data`, etc.  |
| `raw_name`       | Actual column name in the source Excel file           |

**Example rows:**

| canonical_name | source          | raw_name     |
|----------------|-----------------|--------------|
| Claim_ID       | denial_records  | Claim_ID     |
| Claim_ID       | denial_records  | claim_id     |
| Material_ID    | material_master | MaterialID   |

Add a new row here to support a renamed column without changing any Python code.

---

### `Scenarios` (required)

One row per business scenario.

| Column                         | Description                                                  |
|--------------------------------|--------------------------------------------------------------|
| `scenario_name`                | Must match a canonical reason code (e.g. `PRICE_VARIANCE`)  |
| `primary_source`               | Source key for the main lookup table                         |
| `join_keys`                    | Comma-separated canonical field names for the join           |
| `secondary_join_keys`          | (Optional) Fallback join keys if primary returns no match    |
| `duplicate_match_strategy`     | `manual_review` (default) or `first`                         |
| `default_agent_status_no_match`| `Data Missing` or `Needs Manual Review`                      |

**Current scenarios:**

| scenario_name      | primary_source   | join_keys                              |
|--------------------|------------------|----------------------------------------|
| MAT_ATTR_MISMATCH  | material_master  | Material_ID                            |
| CUST_ELIGIBILITY   | customer_master  | Customer_ID                            |
| CONTRACT_MISMATCH  | contracts_data   | Contract_ID                            |
| MISSING_CONTRACT   | contracts_data   | Customer_ID,Material_ID                |
| PRICE_VARIANCE     | pricing_data     | Contract_ID,Material_ID,Customer_ID   |

---

### `Validation_Rules` (optional)

One row per validation check within a scenario.

| Column                   | Description                                            |
|--------------------------|--------------------------------------------------------|
| `scenario_name`          | Links to the Scenarios sheet                           |
| `rule_id`                | Unique identifier (e.g. `R001`)                        |
| `left_field`             | Canonical field from the merged denial+source record   |
| `operator`               | See supported operators below                          |
| `right_field_or_value`   | Canonical field name OR literal value to compare against|
| `tolerance`              | Numeric tolerance for `price_difference`               |
| `research_finding_pass`  | Text shown when rule passes                            |
| `research_finding_fail`  | Text shown when rule fails                             |
| `recommended_action_pass`| Recommended action on pass                             |
| `recommended_action_fail`| Recommended action on fail                             |

**Supported operators:**

| Operator          | Description                                              |
|-------------------|----------------------------------------------------------|
| `equals`          | String equality                                          |
| `not_equals`      | String inequality                                        |
| `exists`          | Field is present and non-blank                           |
| `not_exists`      | Field is absent or blank                                 |
| `is_blank`        | Field value is empty/whitespace                          |
| `is_not_blank`    | Field value is non-empty                                 |
| `greater_than`    | Numeric comparison: left > right                         |
| `less_than`       | Numeric comparison: left < right                         |
| `between_dates`   | Date range check; `right_field_or_value` = `start,end`  |
| `price_difference`| `abs(left - right) <= tolerance`                         |

---

### `Reason_Code_Map` (optional)

Maps raw reason code variants to canonical codes.

| Column           | Description                      |
|------------------|----------------------------------|
| `canonical_code` | The canonical reason code        |
| `variant`        | An alternative spelling/casing   |

**Example rows:**

| canonical_code | variant        |
|----------------|----------------|
| PRICE_VARIANCE | price_variance |
| PRICE_VARIANCE | Price Variance |
| PRICE_VARIANCE | price-variance |

Note: Each canonical code automatically maps to itself.
Normalisation strips/lowercases and replaces spaces and hyphens with underscores before lookup.
If two canonicals share the same normalised key, the record is marked **Needs Manual Review**.

---

### `Output_Defaults` (optional)

Two-column vertical table overriding default output field values.

| key                        | value                   |
|----------------------------|-------------------------|
| ecc_update_type            | Research Finding Only   |
| financial_posting_allowed  | No                      |
| pricing_change_allowed     | No                      |

---

### `Output_Template` (optional)

Ordered list of output column names. Overrides the default column order.

| column_name               |
|---------------------------|
| Claim_ID                  |
| Denial_ID                 |
| Reason_Code               |
| Primary_Source_Checked    |
| Research_Finding          |
| Recommended_Next_Action   |
| ECC_Update_Type           |
| Financial_Posting_Allowed |
| Pricing_Change_Allowed    |
| Agent_Status              |
| Processed_Timestamp       |

---

## Adding a new scenario (no code changes required)

1. Add a row to the **Scenarios** sheet with the new `scenario_name`, `primary_source`, and `join_keys`.
2. Add validation rows in **Validation_Rules** referencing the new `scenario_name`.
3. If the new scenario uses a renamed column, add alias rows to **Field_Aliases**.
4. If agents enter the reason code differently, add variant rows to **Reason_Code_Map**.
5. Re-upload the rules brain — the backend will pick up the changes automatically.

---

## Adding a new data source (API or database)

The `DataSource` abstraction in `data_sources.py` makes this straightforward:

```python
from app.data_sources import DataSource
import pandas as pd

class ApiDataSource(DataSource):
    def __init__(self, key: str, base_url: str, token: str) -> None:
        self._key = key
        self._base_url = base_url
        self._token = token

    @property
    def source_key(self) -> str:
        return self._key

    def get_dataframe(self) -> pd.DataFrame:
        # Fetch from external API, return as DataFrame with canonical column names
        response = requests.get(f"{self._base_url}/data", headers={"Authorization": f"Bearer {self._token}"})
        return pd.DataFrame(response.json())
```

Then register it in `file_registry.py` alongside the existing Excel sources.
The join and validation engines require no changes — they work against any `DataSource`.

---

## Safety guardrails

The backend **never**:
- Approves or rejects claims
- Posts financial documents
- Changes pricing in source systems
- Modifies or overwrites any uploaded file
- Fabricates or infers missing financial values

The backend **only**:
- Reads uploaded files in memory
- Validates records against configured rules
- Generates structured research findings
- Writes `OutputFile_Generated.xlsx` to the HTTP response

---

## Output file

The generated Excel file (`OutputFile_Generated.xlsx`) contains one sheet — **Results** — with these columns (in order):

1. Claim_ID
2. Denial_ID
3. Reason_Code
4. Primary_Source_Checked
5. Research_Finding
6. Recommended_Next_Action
7. ECC_Update_Type
8. Financial_Posting_Allowed
9. Pricing_Change_Allowed
10. Agent_Status
11. Processed_Timestamp

The **Agent_Status** column is colour-coded:
- 🟢 **Ready for ECC Research Note** — soft green
- 🟡 **Needs Manual Review** — soft yellow
- 🔴 **Data Missing** — soft red
