# STATE HANDOFF DOCUMENT
## Claims Denial Validation MVP — Backend System

**Version:** 1.0  
**Date:** 2026-04-26  
**Status:** MVP backend built, Excel input files not yet validated against live data  

---

## 1. SYSTEM OVERVIEW

### What the system does
Accepts uploaded Excel files containing insurance claims denial records and reference master data. For each denial record, it:
1. Identifies the denial scenario from the Reason_Code
2. Joins the denial record against the appropriate master data source
3. Applies validation rules defined in the rules brain
4. Produces a structured Excel output file with research findings and recommended next actions for an agent to act on

### Inputs
Six multipart form file uploads via `POST /process-claims`:

| Form Field | File |
|---|---|
| `denial_records` | DenialRecords_Populated.xlsx |
| `contracts_data` | ContractsData_Populated.xlsx |
| `customer_master` | CustomerMasterRecords_Populated.xlsx |
| `material_master` | MaterialMasterRecords_Populated.xlsx |
| `pricing_data` | PricingData_Populated.xlsx |
| `rules_brain` | Claims_AI_Rules_Brain_Renewed.xlsx |

### Outputs
A single Excel file: `OutputFile_Generated.xlsx`  
One output row per denial record — no rows are dropped or skipped.

### Explicitly OUT OF SCOPE
- No LLM calls at runtime (zero)
- No claim approval or rejection
- No financial postings
- No pricing changes in source systems
- No modification of any uploaded source file
- No database (files only, in-memory per request)
- No authentication, frontend, dashboards, or async background jobs

---

## 2. CURRENT FILE CONTRACT

### DenialRecords_Populated.xlsx
**Purpose:** Primary input. One row per denial to be processed.  
**Key fields used:**
- `Claim_ID` — carried through to output, not used for joins
- `Denial_ID` — carried through to output, used for logging
- `Reason_Code` — determines which scenario + join + validation path to execute
- `Material_ID` — join key for MAT_ATTR_MISMATCH and MISSING_CONTRACT
- `NDC` — fallback join key for MAT_ATTR_MISMATCH
- `Customer_ID` — join key for CUST_ELIGIBILITY and MISSING_CONTRACT
- `Contract_ID` — join key for CONTRACT_MISMATCH and PRICE_VARIANCE
- `Denial_Date` — used in CONTRACT_MISMATCH date range validation
- `Submitted_Price` — used in PRICE_VARIANCE price comparison
- `Vendor_ID` — used in MAT_ATTR_MISMATCH validation (matched against material master)

### ContractsData_Populated.xlsx
**Purpose:** Source of truth for contract assignments.  
**Key fields used:**
- `Contract_ID` — primary join key for CONTRACT_MISMATCH
- `Customer_ID` — join key for MISSING_CONTRACT; validation field for CONTRACT_MISMATCH
- `Material_ID` — join key for MISSING_CONTRACT; validation field for CONTRACT_MISMATCH
- `Contract_Status` — validated as "Active" in CONTRACT_MISMATCH
- `Contract_Start_Date` — used in between_dates check for CONTRACT_MISMATCH
- `Contract_End_Date` — used in between_dates check for CONTRACT_MISMATCH

### CustomerMasterRecords_Populated.xlsx
**Purpose:** Customer eligibility reference.  
**Key fields used:**
- `Customer_ID` — primary join key for CUST_ELIGIBILITY
- `Customer_Status` — validated as "Active"
- `Eligibility_Status` — validated as "Eligible"

### MaterialMasterRecords_Populated.xlsx
**Purpose:** Material/NDC attribute reference.  
**Key fields used:**
- `Material_ID` — primary join key for MAT_ATTR_MISMATCH
- `NDC` — secondary (fallback) join key for MAT_ATTR_MISMATCH
- `Vendor_ID` — validated against denial record Vendor_ID
- `Material_Status` — validated as "Active"

### PricingData_Populated.xlsx
**Purpose:** Expected pricing for contract/material/customer combinations.  
**Key fields used:**
- `Contract_ID` — join key (part of composite)
- `Material_ID` — join key (part of composite)
- `Customer_ID` — join key (part of composite)
- `Expected_Price` — compared against `Submitted_Price` from denial record

### Claims_AI_Rules_Brain_Renewed.xlsx
**Purpose:** Single source of truth for all business logic. Controls every configurable behavior. No business rules should be hardcoded in Python code. See Section 3 for full sheet-by-sheet breakdown.

---

## 3. RULES BRAIN STRUCTURE

The rules brain is `Claims_AI_Rules_Brain_Renewed.xlsx`. It is parsed once per request in `rules_loader.py` into a `RulesBrain` config object. All sheets use row 1 as headers. Column matching is case-insensitive.

### Required Sheets (parsing fails with HTTP 400 if missing)

#### `Field_Aliases`
Maps raw source file column names to internal canonical names.  
**Columns:** `canonical_name | source | raw_name`  
- `canonical_name`: internal name used throughout the pipeline (e.g. `Material_ID`)
- `source`: the registry key of the file (e.g. `denial_records`, `material_master`)
- `raw_name`: the actual column header in that Excel file (e.g. `MaterialID`, `mat_id`)
- One row per alias. A column with multiple variants needs multiple rows.
- Controls: field normalization in `field_mapper.py`

#### `Scenarios`
One row per business scenario. Defines join strategy for each Reason_Code.  
**Columns:** `scenario_name | primary_source | join_keys | secondary_join_keys | duplicate_match_strategy | default_agent_status_no_match`  
- `scenario_name`: must exactly match the canonical reason code (e.g. `MAT_ATTR_MISMATCH`)
- `primary_source`: registry key of the source file to join against
- `join_keys`: comma-separated canonical field names for the join (e.g. `Material_ID`)
- `secondary_join_keys`: comma-separated fallback join keys tried if primary join returns no match
- `duplicate_match_strategy`: `manual_review` (default) or `first` — controls behavior when join returns >1 row
- `default_agent_status_no_match`: `Data Missing` or `Needs Manual Review` — used when join returns 0 rows
- Controls: join routing in `join_engine.py` and `processor.py`

### Optional Sheets (graceful fallback to defaults if missing)

#### `Validation_Rules`
One row per validation check. Controls what gets checked after a successful join.  
**Columns:** `scenario_name | rule_id | left_field | operator | right_field_or_value | tolerance | research_finding_pass | research_finding_fail | recommended_action_pass | recommended_action_fail`  
- `left_field`: canonical field from the merged (denial + source) record
- `operator`: one of 10 supported operators (see Section 5)
- `right_field_or_value`: either a canonical field name (resolved from merged record) or a literal string value
- `tolerance`: numeric, only used for `price_difference` operator
- Pass/fail finding and action text are taken verbatim from the sheet for output
- Controls: `validation_engine.py`

#### `Reason_Code_Map`
Maps raw reason code variants to canonical codes.  
**Columns:** `canonical_code | variant`  
- Enables normalization: `price_variance`, `Price Variance`, `price-variance` → `PRICE_VARIANCE`
- If the same normalized form maps to two different canonical codes → `Needs Manual Review`
- Controls: `reason_code_mapper.py`

#### `Output_Defaults`
Vertical two-column table of static output defaults.  
**Columns:** `key | value`  
- Keys: `ecc_update_type`, `financial_posting_allowed`, `pricing_change_allowed`
- Applied to every output row that does not override these values
- Controls: `output_writer.py`

#### `Output_Template`
Ordered list defining output column names and sequence.  
**Columns:** `column_name`  
- If present, overrides the hardcoded `DEFAULT_OUTPUT_COLUMNS` in `rules_loader.py`
- Controls: column order in `output_writer.py`

---

## 4. DATA MODEL + JOIN LOGIC

### Primary Keys by File

| File (registry key) | Primary Key |
|---|---|
| `denial_records` | `Denial_ID` |
| `contracts_data` | `Contract_ID` |
| `customer_master` | `Customer_ID` |
| `material_master` | `Material_ID` (primary), `NDC` (fallback) |
| `pricing_data` | Composite: `Contract_ID + Material_ID + Customer_ID` |

### Scenario Join Definitions

#### MAT_ATTR_MISMATCH
- **Primary source:** `material_master`
- **Primary join keys:** `Material_ID` (denial → material master)
- **Secondary join keys:** `NDC` (fallback if no match on Material_ID)
- **Expected match:** exactly 1 row
- **No match:** `Agent_Status = Data Missing`
- **Duplicate:** `Agent_Status = Needs Manual Review`

#### CUST_ELIGIBILITY
- **Primary source:** `customer_master`
- **Primary join keys:** `Customer_ID` (denial → customer master)
- **Secondary join keys:** none
- **Expected match:** exactly 1 row
- **No match:** `Agent_Status = Data Missing`
- **Duplicate:** `Agent_Status = Needs Manual Review`

#### CONTRACT_MISMATCH
- **Primary source:** `contracts_data`
- **Primary join keys:** `Contract_ID` (denial → contracts data)
- **Secondary join keys:** none
- **Expected match:** exactly 1 row; then validate cross-fields
- **No match:** `Agent_Status = Data Missing`
- **Duplicate:** `Agent_Status = Needs Manual Review`

#### MISSING_CONTRACT
- **Primary source:** `contracts_data`
- **Primary join keys:** `Customer_ID + Material_ID` (denial → contracts data)
- **Semantics are inverted:** no match = the expected positive finding ("contract is indeed missing")
- **No match → output:**
  - `Primary_Source_Checked = Contract Data`
  - `Research_Finding = No matching contract found.`
  - `Recommended_Next_Action = Research contract coverage and confirm correct contract assignment.`
  - `Agent_Status = Data Missing`
- **Match found (unexpected):**
  - `Research_Finding = Matching contract was found in Contract Data.`
  - `Recommended_Next_Action = Review contract assignment and validate claim.`
  - `Agent_Status = Needs Manual Review`

#### PRICE_VARIANCE
- **Primary source:** `pricing_data`
- **Primary join keys:** `Contract_ID + Material_ID + Customer_ID` (all three must match)
- **Secondary join keys:** none
- **Expected match:** exactly 1 row; then compare Submitted_Price vs Expected_Price
- **No match:** `Agent_Status = Data Missing`
- **Duplicate:** `Agent_Status = Needs Manual Review`

---

## 5. VALIDATION LOGIC

### Supported Operators

| Operator | Description | Notes |
|---|---|---|
| `equals` | `str(left).strip() == str(right).strip()` | Case-sensitive string equality |
| `not_equals` | `str(left).strip() != str(right).strip()` | |
| `exists` | Field present and non-blank | Blank = empty string, None, NaN |
| `not_exists` | Field absent or blank | |
| `is_blank` | Value is empty/whitespace/NaN | |
| `is_not_blank` | Value is non-empty | |
| `greater_than` | `float(left) > float(right)` | Fails → Manual Review if non-numeric |
| `less_than` | `float(left) < float(right)` | Fails → Manual Review if non-numeric |
| `between_dates` | `start_date <= check_date <= end_date` | `right_field_or_value = "start_field,end_field"` |
| `price_difference` | `abs(float(left) - float(right)) <= tolerance` | Fails → Manual Review if non-numeric |

The `right_field_or_value` column is resolved as follows:
1. If the value is a key present in the merged record dict → use the record's value for that key
2. Otherwise → treat as a literal string for comparison

### Per-Scenario Validation Checks (from rules brain)

All validation checks are driven by the `Validation_Rules` sheet. The table below describes the **expected** checks based on the spec — the rules brain is the authoritative source, not this document.

#### MAT_ATTR_MISMATCH — expected checks
- `Material_ID`: `exists` — confirms record was found
- `NDC`: `equals` → denial `NDC` vs material master `NDC`
- `Vendor_ID`: `equals` → denial `Vendor_ID` vs material master `Vendor_ID`
- `Material_Status`: `equals` → literal `"Active"`

#### CUST_ELIGIBILITY — expected checks
- `Customer_Status`: `equals` → literal `"Active"`
- `Eligibility_Status`: `equals` → literal `"Eligible"`

#### CONTRACT_MISMATCH — expected checks
- `Customer_ID`: `equals` → denial `Customer_ID` vs contract `Customer_ID`
- `Material_ID`: `equals` → denial `Material_ID` vs contract `Material_ID`
- `Contract_Status`: `equals` → literal `"Active"`
- `Denial_Date`: `between_dates` → `Contract_Start_Date,Contract_End_Date`

#### MISSING_CONTRACT
- No validation rules apply — the join result itself is the finding (see Section 4).

#### PRICE_VARIANCE — expected checks
- `Submitted_Price`: `price_difference` → compared against `Expected_Price`, with tolerance from rules brain

### Validation Aggregation Logic
- All rules for a scenario are evaluated sequentially.
- **All pass** → `Agent_Status = Ready for ECC Research Note`
- **Any fail** → `Agent_Status = Needs Manual Review`
- **Any evaluation error** (parse failure, bad type) → `Agent_Status = Needs Manual Review`
- **No rules configured** for scenario → `Agent_Status = Needs Manual Review`, finding = `"No validation rules configured for this scenario."`
- `Research_Finding` = all individual rule findings joined with ` | `
- `Recommended_Next_Action` = all individual rule actions joined with ` | `

---

## 6. OUTPUT GENERATION RULES

### Column Population Logic

| Column | Source |
|---|---|
| `Claim_ID` | Taken directly from denial record |
| `Denial_ID` | Taken directly from denial record |
| `Reason_Code` | The **canonical** resolved code (not the raw input value) |
| `Primary_Source_Checked` | `scenario.primary_source` title-cased (e.g. `material_master` → `Material Master`). MISSING_CONTRACT = hardcoded `"Contract Data"` |
| `Research_Finding` | Aggregated from validation rule results, or a scenario-specific override string |
| `Recommended_Next_Action` | Aggregated from validation rule results, or a scenario-specific override string |
| `ECC_Update_Type` | From `Output_Defaults` sheet; default = `"Research Finding Only"` |
| `Financial_Posting_Allowed` | From `Output_Defaults` sheet; default = `"No"` |
| `Pricing_Change_Allowed` | From `Output_Defaults` sheet; default = `"No"` |
| `Agent_Status` | Decision logic (see below) |
| `Processed_Timestamp` | US Central Time with UTC offset — computed once per request |

### Agent_Status Decision Logic

```
1. Reason code empty or unresolvable → "Needs Manual Review"
2. Reason code ambiguous (maps to >1 canonical) → "Needs Manual Review"
3. Reason code unknown (no matching scenario) → "Needs Manual Review"
4. MISSING_CONTRACT + no contract found → "Data Missing"
5. MISSING_CONTRACT + contract found → "Needs Manual Review"
6. Join returns 0 rows → scenario.default_agent_status_no_match (usually "Data Missing")
7. Join returns >1 rows (duplicate) → "Needs Manual Review"
8. Join returns 1 row + all validation rules pass → "Ready for ECC Research Note"
9. Join returns 1 row + any validation rule fails → "Needs Manual Review"
```

### Processed_Timestamp Format
```
2026-04-26 17:45:12 CDT (UTC-05:00)
2026-12-10 17:45:12 CST (UTC-06:00)
```
- Timezone: `America/Chicago` via Python `zoneinfo`
- Abbreviation from `strftime("%Z")` — gives `CDT` or `CST` automatically
- UTC offset computed from `utcoffset()` as `UTC±HH:MM`
- All rows in one request share the same timestamp (generated once in `output_writer.py`)

### Research_Finding Special Overrides (non-validation paths)

| Situation | Research_Finding value |
|---|---|
| Unknown reason code | `"Unknown reason code. No configured rule found."` |
| Ambiguous reason code | `"Reason code '{raw}' is ambiguous after normalisation and maps to multiple configured scenarios."` |
| Source data unavailable | `"Source '{key}' is not available."` |
| No join match (general) | `"No matching source record found."` |
| Duplicate matches | `"Duplicate matching source records found ({n} matches). Cannot determine correct record without manual review."` |
| MISSING_CONTRACT (no match) | `"No matching contract found."` |
| MISSING_CONTRACT (match found) | `"Matching contract was found in Contract Data."` |

### Check Mark Prefix
For rows where `Agent_Status = "Ready for ECC Research Note"`, the `Research_Finding` cell is prefixed with `✓ ` (UTF-8 check mark + space). This is applied by `excel_styler.py` at write time, not during processing.

---

## 7. EDGE CASE HANDLING

| Situation | Agent_Status | Behavior |
|---|---|---|
| Missing lookup record (join returns 0) | `Data Missing` (or `Needs Manual Review` per scenario config) | Output row generated with override Research_Finding text. Processing continues. |
| Duplicate lookup matches (join returns >1) | `Needs Manual Review` | Research_Finding notes count of duplicates. No data from any match is used for validation. Processing continues. |
| Unknown Reason_Code | `Needs Manual Review` | `Primary_Source_Checked = "Multiple Sources"`. Processing continues. |
| Ambiguous Reason_Code (normalises to multiple canonicals) | `Needs Manual Review` | Research_Finding explains ambiguity. Processing continues. |
| Blank Reason_Code | `Needs Manual Review` | Treated as unknown. Processing continues. |
| Join key blank on denial row | Join returns 0 rows → treated as no match | A blank join key cannot match anything. |
| Validation rule evaluation error (bad type, bad date) | `Needs Manual Review` | Rule result captures error text in Research_Finding. Other rules still evaluated. |
| Source file not loaded (exception at load time) | `Needs Manual Review` per affected rows | Warning logged. Rows for that scenario report source unavailable. |
| Internal row processing exception | `Needs Manual Review` | Row-level exception caught. Error text in Research_Finding. Row included in output. Request does not crash. |
| Entire denial file unreadable | HTTP 400 | Fatal — request fails with clear error message. |
| Rules brain missing required sheet | HTTP 400 | Fatal — `MissingRulesBrainSheetError` raised before any processing. |
| Required canonical column absent after aliasing | HTTP 400 | Fatal — `MissingSourceColumnError` raised. |

**Critical constraint:** The backend must never fabricate, infer, or default-fill any financial value. If data is missing, the row is marked appropriately and the finding explains what is missing.

---

## 8. STYLING RULES

- **Only the `Agent_Status` column is styled.** No other column receives fill, font, or border styling beyond the global header row.
- Styling is applied in `excel_styler.py` using `openpyxl` after the DataFrame is written.

### Color Mapping (ARGB hex, openpyxl `fgColor` format)

| Agent_Status value | Fill color (ARGB) | Description |
|---|---|---|
| `Ready for ECC Research Note` | `FFD6EAD7` | Soft muted green |
| `Needs Manual Review` | `FFFFF2CC` | Soft muted yellow |
| `Data Missing` | `FFFCE4E4` | Soft muted red |

### Header Row Styling
- All header cells: bold font, light grey fill (`FFD9D9D9`), center-aligned
- This is acceptable supplemental styling — it does not conflict with the Agent_Status-only rule for data rows

### Column Widths
- Auto-width applied to all columns based on max content length, capped at 60 characters
- This is cosmetic only and does not affect data

---

## 9. SYSTEM CONSTRAINTS (CRITICAL)

### The system MUST NEVER:
- Approve any claim
- Reject any claim
- Post financial documents or entries
- Change pricing in any source system
- Modify, overwrite, or save any uploaded file
- Fabricate a value for a missing field
- Infer financial values from incomplete data
- Call any external API or LLM at runtime

### The system MAY ONLY:
- Read uploaded files entirely in memory
- Apply deterministic validation logic from the rules brain
- Produce `OutputFile_Generated.xlsx` as the HTTP response body
- Log warnings and errors for operational visibility

---

## 10. CURRENT IMPLEMENTATION NOTES

### Backend Location
```
backend/
  app/
    main.py              – FastAPI app, endpoints
    processor.py         – Orchestration: ties all modules together, per-row loop
    data_sources.py      – DataSource ABC + ExcelDataSource + InMemoryDataSource
    file_registry.py     – Maps form field names → DataSource instances
    rules_loader.py      – Parses rules brain workbook → RulesBrain config object
    field_mapper.py      – Applies Field_Aliases → canonical column names
    reason_code_mapper.py – Normalises reason codes, detects ambiguity
    join_engine.py       – Per-row join logic with primary + fallback key support
    validation_engine.py – Evaluates 10 operators against merged records
    output_writer.py     – Assembles DataFrame, computes timestamp, writes Excel
    excel_styler.py      – Applies openpyxl fills, header style, auto-width
    errors.py            – Custom exception hierarchy
    schemas.py           – Pydantic models (RulesBrain, ScenarioConfig, etc.)
  tests/
    conftest.py
    test_rules_loader.py
    test_field_mapper.py
    test_reason_code_mapper.py
    test_join_engine.py
    test_validation_engine.py
    test_output_writer.py
```

### Processing Flow (per request)
```
1. main.py: read all 6 uploaded files as bytes
2. rules_loader.py: parse rules brain → RulesBrain (cached for this request)
3. file_registry.py: build FileRegistry from 5 data files
4. processor.py: build alias_index from field_aliases
5. processor.py: load all source DataFrames, apply aliases → canonical column names
6. processor.py: pop denial_records from source_dfs
7. processor.py: for each denial row:
   a. reason_code_mapper.py: resolve raw code → canonical or error hint
   b. look up ScenarioConfig from brain.scenarios
   c. join_engine.py: join denial row against primary source
   d. validation_engine.py: evaluate rules → ScenarioResult
   e. build output row dict
8. output_writer.py: build DataFrame, apply defaults, stamp timestamp
9. excel_styler.py: apply fills + header style
10. main.py: return bytes as HTTP response
```

### Known Limitations
- **Excel files not validated against live data yet.** The rules brain (`Claims_AI_Rules_Brain_Renewed.xlsx`) and the populated data files have not been read by the backend yet — the actual column names, sheet names, and field values in those files are unconfirmed.
- **Column names are assumptions.** All field names used in `Field_Aliases`, `Scenarios`, and `Validation_Rules` sheets of the rules brain must exactly match what is in the actual data files. If the rules brain was created with different column names than what the data files contain, the backend will either silently fail to find matches (returning all `Data Missing`) or crash with `MissingSourceColumnError`.
- **MISSING_CONTRACT** row in `processor.py` hardcodes `Agent_Status = "Data Missing"` rather than reading `scenario.default_agent_status_no_match`. This is a minor inconsistency — the hardcoded value happens to be the correct default, but it bypasses the rules brain config for that field.
- **Python 3.9 compatibility.** The codebase was written with `from __future__ import annotations` and explicit `Optional[x]` / `Union[x, y]` typing to support Python 3.9. The `str | None` union syntax is not used in any Pydantic model fields.
- **All 78 tests pass** on the current codebase against in-memory mock DataFrames.
- **The actual Excel data files** (`DenialRecords_Populated.xlsx`, etc.) have not been run through the backend end-to-end. This is the primary remaining validation gap.

---

## 11. TESTING STRATEGY

### Current Test Coverage (78 tests, all passing)

| Test file | What it covers |
|---|---|
| `test_rules_loader.py` | Rules brain parsing, required/optional sheets, defaults, override behavior |
| `test_field_mapper.py` | Alias index building, column renaming, required column assertion |
| `test_reason_code_mapper.py` | Exact matches, case variants, hyphen/space variants, ambiguity, unknown codes |
| `test_join_engine.py` | All 5 scenario join patterns, blank keys, duplicates, fallback keys, `first` strategy |
| `test_validation_engine.py` | All 10 operators (pass and fail), no-rules case, field reference resolution |
| `test_output_writer.py` | Exact column order, defaults, timestamp format+timezone, Excel fills by status, ✓ prefix |

### What Needs to Be Tested Next (not yet covered)

1. **End-to-end with real files** — upload all 6 actual Excel files to `POST /process-claims`, confirm HTTP 200 and valid Excel output
2. **Rules brain column name alignment** — confirm that the actual `Claims_AI_Rules_Brain_Renewed.xlsx` `Field_Aliases` sheet covers all columns used by the 5 data files
3. **Validation rule correctness** — confirm that rules in `Validation_Rules` sheet produce the same findings as `OutputFile_Populated.xlsx`
4. **MISSING_CONTRACT inversion logic** — confirm that denial records with no matching contract produce `Data Missing` (not `Needs Manual Review`)
5. **Comparison against expected output** — diff generated output against `OutputFile_Populated.xlsx` for structure, values, and styling

### How to Run Tests
```bash
cd backend
python3 -m pytest tests/ -v
```

### How to Run End-to-End
```bash
cd backend
uvicorn app.main:app --reload --port 8000

curl -X POST http://localhost:8000/process-claims \
  -F "denial_records=@../DenialRecords_Populated.xlsx" \
  -F "contracts_data=@../ContractsData_Populated.xlsx" \
  -F "customer_master=@../CustomerMasterRecords_Populated.xlsx" \
  -F "material_master=@../MaterialMasterRecords_Populated.xlsx" \
  -F "pricing_data=@../PricingData_Populated.xlsx" \
  -F "rules_brain=@../Claims_AI_Rules_Brain_Renewed.xlsx" \
  --output OutputFile_Generated.xlsx
```

---

## 12. DEFINITION OF DONE

The system is complete and production-ready when ALL of the following are true:

- [ ] `POST /process-claims` with all 6 real files returns HTTP 200 and valid Excel
- [ ] Every denial record in `DenialRecords_Populated.xlsx` produces exactly one output row
- [ ] Output columns match the exact 11-column schema in the correct order
- [ ] `ECC_Update_Type = "Research Finding Only"` on all rows (unless overridden by rules brain)
- [ ] `Financial_Posting_Allowed = "No"` on all rows
- [ ] `Pricing_Change_Allowed = "No"` on all rows
- [ ] `Agent_Status` is one of exactly: `Ready for ECC Research Note`, `Needs Manual Review`, `Data Missing`
- [ ] Agent_Status column cells have correct fill color; no other data cells are styled
- [ ] `Processed_Timestamp` matches format `YYYY-MM-DD HH:MM:SS CDT/CST (UTC±HH:MM)`
- [ ] Output structure and logical values are consistent with `OutputFile_Populated.xlsx`
- [ ] No `Research_Finding` contains a fabricated or inferred financial value
- [ ] All 78 unit tests pass
- [ ] Unknown reason codes produce `Needs Manual Review` (not a crash)
- [ ] Missing source data produces `Data Missing` (not a crash)
- [ ] Duplicate source matches produce `Needs Manual Review` (not a crash)

---

## 13. KNOWN RISKS / AMBIGUITIES

### HIGH PRIORITY — Must Resolve Before Confirming Done

1. **Rules brain column name alignment is unverified.** The `Field_Aliases`, `Scenarios`, and `Validation_Rules` sheets in `Claims_AI_Rules_Brain_Renewed.xlsx` have not been read. If the canonical names defined there do not match the actual column headers in the data files, all joins will silently return no matches. **First action for next agent: read and inspect all sheets of the rules brain and all data files, then confirm alignment.**

2. **`Primary_Source_Checked` label format.** The current code does `scenario.primary_source.replace("_", " ").title()` which produces e.g. `Material Master` from `material_master`. If `OutputFile_Populated.xlsx` shows a different label (e.g. `Material Master Records` or `Material Master Data`), this must be corrected — either via a `display_name` column in the Scenarios sheet or a direct fix.

3. **Validation rule text matching.** The `research_finding_pass`, `research_finding_fail`, `recommended_action_pass`, `recommended_action_fail` values in the `Validation_Rules` sheet are taken verbatim. If `OutputFile_Populated.xlsx` uses specific phrasing, those exact strings must be in the rules brain sheet. The code does not rephrase them.

4. **MISSING_CONTRACT Agent_Status inconsistency.** In `processor.py`, the `_missing_contract_row()` function hardcodes `Agent_Status = "Data Missing"` instead of reading `scenario.default_agent_status_no_match`. This is currently the correct value but bypasses configurability. If the rules brain sets a different default for MISSING_CONTRACT, it will be ignored. Fix: replace the hardcoded string with `scenario.default_agent_status_no_match`.

5. **Price comparison field names.** The PRICE_VARIANCE validation assumes `Submitted_Price` (from denial records) and `Expected_Price` (from pricing data). If the actual column names differ, the `price_difference` rule will evaluate against blank values and return `Needs Manual Review`. Must be confirmed against actual files.

### MEDIUM PRIORITY — Monitor

6. **`Duplicate_Match_Strategy` in rules brain vs hardcoded `"manual_review"` default.** The `Scenarios` parser defaults to `"manual_review"` when the column is blank. If a scenario should use `"first"`, it must be explicitly set in the sheet.

7. **Date parsing for `between_dates`.** Dates in Excel files read as strings via `dtype=str` in `pd.read_excel`. The `_to_date()` function uses `pd.to_datetime(str(v))` which is generally permissive, but unusual date formats (e.g. Excel serial numbers, locale-specific formats) may fail and produce `Needs Manual Review` for CONTRACT_MISMATCH date checks.

8. **All prices read as strings.** Because all Excel columns are read with `dtype=str`, the `_to_float()` function must successfully parse the price format used in the data (e.g. `"100.00"`, `"$100.00"`, `"100,00"`). The current parser strips commas but not dollar signs. Verify format in actual pricing data.

9. **Reason_Code_Map sheet is optional.** If the rules brain does not include this sheet, normalisation relies only on the self-mapping of canonical codes. Any non-standard casing in the actual denial records (`price variance`, `PriceVariance`) would be treated as unknown.

10. **No sheet exists for output text overrides per scenario.** Research_Finding and Recommended_Next_Action for edge cases (no match, duplicate, unknown code) are hardcoded strings in `processor.py`. These cannot currently be changed via the rules brain. If the expected output uses different phrasing, a code change is needed, or a new `Override_Messages` sheet must be added to the rules brain and parser.

### LOW PRIORITY — Future Considerations

11. **No request-level caching across requests.** Rules brain is re-parsed on every request. Acceptable for MVP; consider caching if performance is needed.

12. **Single-threaded pandas per request.** For large denial files (thousands of rows), the row-by-row Python loop in `processor.py` will be the bottleneck. The architecture supports future vectorization but current MVP prioritizes correctness.

13. **DataSource abstraction is in place** for future API/database sources but no implementation exists beyond Excel. Adding a new source type requires: subclass `DataSource`, implement `get_dataframe()`, register in `file_registry.py`.

---

*End of State Handoff Document*
