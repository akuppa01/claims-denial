# STATE HANDOFF

## Snapshot

- Repo: `claims-denial`
- Active branch: `main` (all feature branches merged)
- Branch lineage (merged):
  `main` <- `feat/latest-integrated-app` <- `feat/agentic-ui` <- `divestiture-additions`
- App shape: monorepo with FastAPI backend and TanStack Start frontend
- Date: `2026-05-06`

## Current Repo Layout

```text
Claims Denial/
├── backend/
├── frontend/
├── project-context/
│   ├── START_HERE.md
│   ├── STATE_HANDOFF.md
│   ├── ISSUES_AND_DISCREPANCIES.md
│   ├── backend/README.md
│   └── frontend/README.md
├── README.md
├── package.json
└── vercel.json
```

## What Exists Today

### Backend

- Core endpoint is `POST /process-claims`
- Input is `multipart/form-data` with exactly 6 fields:
  `denial_records`, `contracts_data`, `customer_master`, `material_master`, `pricing_data`, `rules_brain`
- Output is a generated Excel workbook
- Rules brain is Excel-driven
- Divestiture logic is implemented
- Current backend output now aligns with expected workbook for:
  `Invoice_Date`, `Submission_Date`, `Research_Finding`, `Discrepancy_Details`, `Secondary_Source_Checked`, `Transition_Period_Flag`, `Data_Validation_Result`, `Primary_Source_Checked`

### Frontend

- Full enterprise-style UI exists on `feat/agentic-ui`
- Multi-route shell with sidebar and dashboard
- Upload and validation flow still uses the existing backend endpoint
- Output page still uses placeholder/mock table rows because backend returns binary Excel rather than structured JSON

## Most Relevant Recent Changes

### Backend changes from the divestiture work

- Added divestiture-aware processing and ownership logic
- Added updated rules brain fixture:
  [Claims_AI_Rules_Brain_Updated.xlsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/fixtures/Claims_AI_Rules_Brain_Updated.xlsx)
- Added divestiture tests in
  [test_divestiture_scenarios.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/test_divestiture_scenarios.py)

### Backend changes from the latest discrepancy pass

- Processor now normalizes output date formatting
- Processor now emits scenario-level `Research_Finding` and `Discrepancy_Details`
- Processor now aligns source labels with expected workbook
- Processor now applies a more conservative issue-tracking posture
- Added focused tests in
  [test_processor_output_semantics.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/test_processor_output_semantics.py)

### Frontend changes on `feat/agentic-ui`

- Replaced the old single-page flow with a multi-page app
- Added shared app state via `AppContext`
- Added dashboard, upload, validate, output, settings, and placeholder routes
- Preserved the backend upload/process flow

## Vercel Deployment

Production URL: **https://frontend-chi-green-15.vercel.app**

Deploy command (must run from `frontend/` — NOT the repo root):

```bash
cd "/Users/adi/Desktop/Coding/Misc/Claims Denial/frontend"
PATH="/Users/adi/.nvm/versions/node/v22.18.0/bin:$PATH" vercel --prod
```

The `.vercel` project link lives in `frontend/.vercel/` (gitignored). The root
`vercel.json` uses `experimentalServices` which caused 404 on all routes — deploy
from `frontend/` directly so Nitro's Vercel preset handles routing natively. The
backend is not on Vercel; the deployed frontend points to `/api` in production
(no backend deployed yet, so validation will not work on the hosted URL).

## Running Locally

Use the main worktree at:
`/Users/adi/Desktop/Coding/Misc/Claims Denial`

**Node 22 is required.** Node 18 (system default) is too old for Vite 7.

### Quickest start (from worktree root)

```bash
cd "/Users/adi/Desktop/Coding/Misc/Claims Denial - latest-integrated-app"
source ~/.nvm/nvm.sh && nvm use 22.18.0

# First time only
npm install
npm --prefix frontend install

# Both backend + frontend
python3 -m uvicorn app.main:app --reload --port 8000 --app-dir backend &
PATH="/Users/adi/.nvm/versions/node/v22.18.0/bin:$PATH" npm --prefix frontend run dev
```

Expected local URLs:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:8081` (8080 is often occupied; Vite auto-increments)

## Test Data

- Sample Excel set:
  `/Users/adi/Desktop/DenialRecords (2)/`
- Updated rules brain fixture:
  [Claims_AI_Rules_Brain_Updated.xlsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/fixtures/Claims_AI_Rules_Brain_Updated.xlsx)

## Backend Status

- Focused regression suite after latest backend edits:
  `70 passed, 12 skipped`
- The earlier broader backend suite on `divestiture-additions` had 131 passing tests before the latest semantic-output changes

## Bug Fixes Applied in This Session (2026-05-06)

These were found and fixed during the first end-to-end local run:

1. **`engine="openpyxl"` missing from all `pd.read_excel()` calls**
   - `backend/app/rules_loader.py` — `_load_all_sheets()`
   - `backend/app/data_sources.py` — `ExcelDataSource.get_dataframe()`
   - Without this, pandas cannot determine the Excel format when reading from
     raw bytes (no filename to infer from), and raises `ValueError`. Every run
     was failing silently and returning an empty output file.

2. **`ScenarioConfig` schema missing 6 new fields**
   - `backend/app/schemas.py` — `ScenarioConfig` model
   - `rules_loader.py` was populating `all_pass_outcome`, `acceptable_next_action`,
     `resubmission_next_action`, `standard_research_finding`,
     `standard_discrepancy_details`, `secondary_source_display` on construction,
     but those fields didn't exist on the Pydantic model. Pydantic dropped them
     silently; processor then threw `AttributeError` on every row, every row was
     skipped, output was empty. Fixed by adding all 6 with empty-string defaults.

3. **CORS allowlist missing port 8081**
   - `backend/app/main.py` — `_allowed_origins()`
   - Frontend lands on 8081 when 8080 is occupied. The CORS middleware was
     blocking all browser API calls. Added 8081 and 8082 to the allowlist.

## Current Open Work

- Frontend output table shows hardcoded sample rows — not wired to real backend response (backend returns binary Excel, not JSON rows; needs a separate structured JSON endpoint or client-side parse of the blob)
- Backend still has unresolved mixed-outcome logic for:
  `PRICE_VARIANCE`, `MAT_ATTR_MISMATCH`, `CONTRACT_MISMATCH`, and a few divestiture scenarios
- AI analyst/settings pages remain mostly scaffolding

## Latest Workbook Compare Summary

Against the expected `OutputFile.xlsx`, these columns are now fully aligned:

- `Invoice_Date`
- `Submission_Date`
- `Research_Finding`
- `Discrepancy_Details`
- `Secondary_Source_Checked`
- `Transition_Period_Flag`
- `Data_Validation_Result`
- `Primary_Source_Checked`

Still open:

- `Denial_Decision`: 64 diffs
- `Agent_Status`: 64 diffs
- `Recommended_Next_Action`: 51 diffs

These remaining diffs are not presentation bugs. They require richer business metadata or clearer business rules.

## Files To Read Next

- [ISSUES_AND_DISCREPANCIES.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/ISSUES_AND_DISCREPANCIES.md)
- [backend/README.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/backend/README.md)
- [frontend/README.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/frontend/README.md)

## Working Tree Notes

At the time of this handoff, notable local changes include:

- backend edits in `processor.py`, `rules_loader.py`, `schemas.py`
- updated tests in `test_divestiture_scenarios.py`
- new backend test file `test_processor_output_semantics.py`
- untracked `frontend/package-lock.json` from a frontend reinstall

Treat those as intentional local work unless explicitly told otherwise.
