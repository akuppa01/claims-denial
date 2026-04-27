# Claims Denial

FastAPI backend plus Vite frontend for claims denial validation and Excel output generation.

## Run Locally

From the repo root:

```bash
npm install
npm run setup
npm run dev
```

That starts:

- FastAPI backend at `http://localhost:8000`
- Vite frontend at the local URL printed by Vite
  - In this repo it served at `http://localhost:8080` during verification

## Notes

- The frontend reads the backend URL from `frontend/.env`
- Local default: `VITE_API_BASE_URL=http://localhost:8000`
- The upload flow posts `multipart/form-data` to `POST /process-claims`
- Required form fields are:
  - `denial_records`
  - `contracts_data`
  - `customer_master`
  - `material_master`
  - `pricing_data`
  - `rules_brain`

## Expected Local Workflow

1. Open the frontend.
2. Upload all 6 Excel files.
3. Click `Next`.
4. Click `Run Validation`.
5. Confirm `OutputFile_Generated.xlsx` downloads successfully.
