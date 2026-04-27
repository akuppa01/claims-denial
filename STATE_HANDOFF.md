# STATE HANDOFF

## Repo Snapshot

- Repo: `claims-denial`
- Branch: `main`
- Date: `2026-04-27`
- App shape: monorepo with FastAPI backend and Lovable-generated React + Vite frontend
- Current status: local run still works, Vercel deployment support was added, the standalone frontend and standalone backend deployments are working, and the original Services-mode project still has a root-route issue

## Top-Level Structure

```text
Claims Denial/
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── processor.py
│   │   ├── rules_loader.py
│   │   ├── output_writer.py
│   │   └── ...
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── .env
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── routes/index.tsx
│       └── ...
└── STATE_HANDOFF.md
```

## Backend Facts

- Backend entrypoint: `backend/app/main.py`
- Direct run command:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

- Root run command:

```bash
npm run dev
```

- Core endpoint: `POST /process-claims`
- Health endpoint: `GET /health`
- `POST /process-claims` already existed and remains the single processing entrypoint
- Endpoint accepts `multipart/form-data` with these exact field names:
  - `denial_records`
  - `contracts_data`
  - `customer_master`
  - `material_master`
  - `pricing_data`
  - `rules_brain`
- Response is binary Excel, not JSON:
  - content type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - attachment filename: `OutputFile_Generated.xlsx`

## Frontend Facts

- Main screen logic is in `frontend/src/routes/index.tsx`
- Direct run commands:

```bash
cd frontend
npm install
npm run dev
```

- Frontend local URL is determined by Vite at startup
- During final verification in this repo, Vite served at `http://localhost:8080`

- Frontend now uses:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

- Local env file is present at `frontend/.env` with:

```env
VITE_API_BASE_URL=http://localhost:8000
```

- Upload flow constructs `FormData` with the exact six backend field names
- Frontend sends:

```ts
fetch(`${API_BASE_URL}/process-claims`, {
  method: "POST",
  body: formData,
});
```

- Frontend does not manually set `Content-Type`
- Successful responses are handled as blob downloads for `OutputFile_Generated.xlsx`
- Error responses are read and surfaced to the UI before any download attempt

## Vercel Facts

- Vercel account used during deployment: `akuppa01`
- Vercel scope/team used: `aditya-ks-projects-89027c29`
- Relevant Vercel projects discovered during this work:
  - `claims-denial`
  - `frontend`
  - `claims-denial-api`
- Working deployed frontend:
  - [https://frontend-chi-green-15.vercel.app](https://frontend-chi-green-15.vercel.app)
- Working deployed backend:
  - [https://claims-denial-api.vercel.app](https://claims-denial-api.vercel.app)
- Verified backend health endpoint:
  - [https://claims-denial-api.vercel.app/health](https://claims-denial-api.vercel.app/health)
- Verified frontend proxy health endpoint:
  - [https://frontend-chi-green-15.vercel.app/api/health](https://frontend-chi-green-15.vercel.app/api/health)
- Important caveat:
  - the existing `claims-denial` Vercel project is configured with `Framework Preset: Services`
  - that project now builds successfully, including frontend Nitro output and backend Python output
  - however [https://claims-denial.vercel.app](https://claims-denial.vercel.app) still returns `404` at `/`
  - meanwhile [https://claims-denial.vercel.app/api/health](https://claims-denial.vercel.app/api/health) works
  - treat `frontend-chi-green-15.vercel.app` as the currently working hosted UI unless/until the Services routing issue is resolved

## Integration Fixes Applied

### Backend

- Added CORS middleware in `backend/app/main.py`
- Default allowed origins include:
  - `http://localhost:3000`
  - `http://localhost:4173`
  - `http://localhost:5173`
  - `http://localhost:8080`
  - `http://127.0.0.1:3000`
  - `http://127.0.0.1:4173`
  - `http://127.0.0.1:5173`
  - `http://127.0.0.1:8080`
- Future deployed frontend domains can be supplied via:

```bash
FRONTEND_CORS_ORIGINS=https://your-frontend.example.com
```

- Added Vercel Python entrypoints:
  - `backend/server.py`
  - `backend/api/index.py`
- Added backend Vercel routing/config file:
  - `backend/vercel.json`
- Backend standalone Vercel deployment now works with explicit rewrites and a Python function include-files rule

### Frontend

- Replaced relative `"/process-claims"` fetch with env-driven backend URL
- Added explicit helper logic for:
  - cleaner FastAPI error extraction
  - consistent Excel blob download behavior
- Updated production fallback API base to `"/api"` so same-origin proxying works in hosted environments
- Rebuilt `frontend/src/routes/index.tsx` into a simpler deployment-safe upload/review/run flow after Vercel route parsing issues surfaced
- Restored placeholder/iCloud-dataless frontend files that were breaking builds:
  - `frontend/package.json`
  - `frontend/vite.config.ts`
- Replaced the frontend Vite config with an explicit Vercel-compatible TanStack Start + Nitro setup
- Added frontend Vercel routing/config file:
  - `frontend/vercel.json`
  - rewrites `/api/:path*` to `https://claims-denial-api.vercel.app/:path*`

### Root Repo

- Added root `package.json` with:
  - `npm run dev` to start backend and frontend together
  - `npm run setup` to install backend and frontend dependencies
- Added root `README.md` with one-command run instructions
- Added root `.gitignore` so local runtime artifacts do not get committed
- Added root `vercel.json` for the original Services-mode Vercel deployment path

## Verification Completed

- Backend test suite:

```bash
cd backend
pytest -q
```

- Result: `96 passed`

- Added dedicated API integration test:
  - file: `backend/tests/test_api_integration.py`
  - verifies multipart upload contract
  - verifies Excel binary response
  - verifies CORS preflight for Vite origin

- Frontend production build:

```bash
cd frontend
npm run build
```

- Result: the original local-build notes are now less important than the hosted build path; Vercel builds were repaired successfully after restoring placeholder files and replacing the Vite config

- Frontend lint:

```bash
cd frontend
npm run lint
```

- Result: no errors in the integration changes
- Remaining lint output is warnings only from pre-existing UI component files about `react-refresh/only-export-components`

- Root run command:

```bash
cd /path/to/repo
npm install
npm run setup
npm run dev
```

- Live end-to-end processing verification:
  - backend started on `http://127.0.0.1:8000`
  - frontend started from the root command and served locally on `http://localhost:8080`
  - CORS preflight to `POST /process-claims` succeeded for `http://localhost:8080`
  - real uploaded input set was processed successfully through `POST /process-claims`
  - backend returned `OutputFile_Generated.xlsx` with the correct Excel content type and attachment header
  - generated workbook matched expected output structure:
    - same 11 columns
    - same column order
    - 100 data rows
    - populated `Processed_Timestamp`
    - valid-looking `Agent_Status` values
    - fill styling present on `Agent_Status`

- Note on browser automation:
  - the in-app browser was able to open and inspect the frontend
  - this browser surface did not expose file-input upload automation, so the exact upload click path could not be driven there
  - the equivalent live backend multipart request with the same six files was executed successfully

- Hosted verification completed on `2026-04-27`:
  - `https://claims-denial-api.vercel.app/health` returned JSON health data
  - `https://frontend-chi-green-15.vercel.app/` returned `HTTP/2 200`
  - `https://frontend-chi-green-15.vercel.app/api/health` successfully proxied to the backend and returned JSON health data
  - `https://claims-denial.vercel.app/api/health` also worked
  - `https://claims-denial.vercel.app/` still returned `HTTP/2 404`

## Important Constraints

- Do not rewrite the processing pipeline unless explicitly requested
- Do not change business logic in:
  - `processor.py`
  - `rules_loader.py`
  - validation/join logic modules
- The integration contract is now stable and should be treated as the baseline:
  - 6 file upload fields
  - `POST /process-claims`
  - binary Excel response download

## Things A Fresh Agent Should Check First

1. Confirm backend is running on port `8000`
2. Confirm frontend `VITE_API_BASE_URL` points to that backend
3. Confirm the actual Vite local port is included in CORS if it is not one of the defaults
4. If upload/download breaks, inspect `frontend/src/routes/index.tsx` and `backend/app/main.py` first
5. If business results look wrong, start with `rules_brain` parsing and backend tests, not the frontend

## Known Non-Blocking Notes

- `frontend/` is present and should be treated as part of the repo now
- Frontend build works after installing dependencies locally
- There are local/generated artifacts that should not drive product decisions:
  - `.DS_Store`
  - `__pycache__/`
  - local `.claude` settings
- Several frontend files in this workspace were iCloud `dataless` placeholders during deployment work; if a future build behaves as if a file is empty, check file flags first
- There are now multiple Vercel projects related to this app:
  - `frontend` is the currently working hosted UI
  - `claims-denial-api` is the currently working hosted API
  - `claims-denial` is the original Services project and still needs root-route debugging if the goal is one canonical domain

## Most Relevant Files

- `backend/app/main.py`
- `backend/api/index.py`
- `backend/server.py`
- `backend/vercel.json`
- `backend/tests/test_api_integration.py`
- `package.json`
- `README.md`
- `frontend/.env`
- `frontend/vercel.json`
- `frontend/vite.config.ts`
- `frontend/src/routes/index.tsx`
- `vercel.json`

## Recommended Next Steps

1. If the goal is simply a working hosted app, keep using `frontend-chi-green-15.vercel.app` plus `claims-denial-api.vercel.app`
2. If the goal is a single canonical domain at `claims-denial.vercel.app`, investigate the Services project routing/output mapping in Vercel rather than the app build itself
3. If you want a simpler long-term setup, consider keeping two explicit Vercel projects:
   - one frontend TanStack Start project
   - one backend Python project
   with the frontend proxying `/api/*` to the backend

## Quick Start

```bash
npm install
npm run setup
npm run dev
```

Or run the services separately:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

Then upload all 6 Excel files in the frontend and run validation. The expected outcome is a download of `OutputFile_Generated.xlsx`.
