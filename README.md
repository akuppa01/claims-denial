# Claims Denial

Monorepo with:

- `frontend/`: Vite React app
- `backend/`: FastAPI app

Production target:

- Frontend on Vercel
- Backend on Render
- Both auto-deploy from the same GitHub repo

## Repo Layout

- Frontend root: `frontend/`
- Backend root: `backend/`
- Frontend package manager: `npm`
- Frontend build command: `npm run build`
- Backend app path: `server:app`
- Backend health endpoint: `GET /health`
- Main processing endpoint: `POST /process-claims`
- Excel download endpoint: `GET /download-output/{file_id}`

## Local Development

From the repo root:

```bash
npm install
npm run setup
npm run dev
```

That starts:

- FastAPI backend at `http://localhost:8000`
- Vite frontend at the local URL printed by Vite

Local environment files:

- `frontend/.env.example`
- `backend/.env.example`

For local frontend-only work, the frontend falls back to:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Frontend Environment

Frontend uses `VITE_API_BASE_URL` for backend requests.

Example:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Production example:

```bash
VITE_API_BASE_URL=https://YOUR-RENDER-BACKEND.onrender.com
```

## Backend Environment

Recommended backend environment variables:

```bash
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
CORS_ORIGINS=http://localhost:5173,https://YOUR-FRONTEND.vercel.app
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
ALLOW_VERCEL_PREVIEWS=true
CLAIMS_DOWNLOAD_DIR=/tmp/claims-denial-downloads
```

Notes:

- `FRONTEND_URL` is the primary production frontend origin.
- `CORS_ORIGINS` can include multiple exact origins separated by commas.
- `CORS_ORIGIN_REGEX` allows preview deploys if you want Vercel preview URLs to work.
- The backend already includes local origins by default.

## Deploy Frontend To Vercel

Target settings:

- Framework Preset: `Vite`
- Root Directory: `frontend`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variable:

```bash
VITE_API_BASE_URL=https://YOUR-RENDER-BACKEND.onrender.com
```

### Manual Vercel Setup

1. Open Vercel and click `Add New...` then `Project`.
2. Import the existing GitHub repo.
3. In project settings, set `Root Directory` to `frontend`.
4. Confirm framework is `Vite`.
5. Set `Build Command` to `npm run build`.
6. Set `Output Directory` to `dist`.
7. Add environment variable `VITE_API_BASE_URL` with your Render backend URL.
8. Click `Deploy`.
9. After Render is live, update `VITE_API_BASE_URL` if you used a placeholder.

Auto-deploy:

- Vercel will create production deploys from pushes to your production branch.
- Vercel will create preview deploys from pull requests and branch pushes.

## Deploy Backend To Render

This repo includes `render.yaml`, but you can also configure Render manually.

Target settings:

- Service Type: `Web Service`
- Runtime: `Python`
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Manual Render Setup

1. Open Render and click `New +`.
2. Choose `Web Service`.
3. Connect the existing GitHub repo.
4. Set `Root Directory` to `backend`.
5. Set `Runtime` to `Python`.
6. Set `Build Command` to `pip install -r requirements.txt`.
7. Set `Start Command` to `uvicorn server:app --host 0.0.0.0 --port $PORT`.
8. Add environment variables:

```bash
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
CORS_ORIGINS=http://localhost:5173,https://YOUR-FRONTEND.vercel.app
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
ALLOW_VERCEL_PREVIEWS=true
CLAIMS_DOWNLOAD_DIR=/tmp/claims-denial-downloads
```

9. Click `Create Web Service`.

Auto-deploy:

- Render will auto-deploy on GitHub pushes once the service is connected to the repo.

## Monorepo Deployment Flow

1. Create the Render backend from `backend/`.
2. Copy the Render URL.
3. Create the Vercel frontend from `frontend/`.
4. Set `VITE_API_BASE_URL` in Vercel to the Render backend URL.
5. Copy the Vercel production URL.
6. Update Render env vars:

```bash
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
CORS_ORIGINS=http://localhost:5173,https://YOUR-FRONTEND.vercel.app
```

7. Redeploy Render after changing backend env vars.

## Upload And Output Flow

The frontend sends `multipart/form-data` to:

- `POST /process-claims`

Required fields:

- `denial_records`
- `contracts_data`
- `customer_master`
- `material_master`
- `pricing_data`
- `rules_brain`

The backend returns:

- processed rows for the frontend UI
- a download URL for the generated Excel file

## Validation Commands

Frontend:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

Backend:

```bash
python3 -m pip install -r backend/requirements.txt
python3 -c "import sys; sys.path.insert(0, 'backend'); from server import app; print(app.title)"
cd backend && pytest -q
```

## Troubleshooting

### CORS errors

- Confirm `FRONTEND_URL` matches the Vercel production URL exactly.
- Confirm `CORS_ORIGINS` includes the production frontend URL.
- If preview deployments fail, keep `ALLOW_VERCEL_PREVIEWS=true` or set `CORS_ORIGIN_REGEX=https://.*\.vercel\.app`.

### Wrong backend URL in production

- Check Vercel project settings.
- Update `VITE_API_BASE_URL` to the Render service URL.
- Redeploy the Vercel project after changing the env var.

### Failed Vercel build

- Confirm `Root Directory` is `frontend`.
- Confirm build command is `npm run build`.
- Confirm dependencies install successfully under `frontend/package.json`.

### Failed Render deploy

- Confirm `Root Directory` is `backend`.
- Confirm start command is `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Confirm `requirements.txt` installed successfully.

### Missing Python dependencies

- Re-run `pip install -r backend/requirements.txt`.
- Check the Render build logs for the package that failed.

### File upload or download issues

- Confirm the frontend is pointing at the Render backend URL.
- Confirm Render request size and timeout limits are acceptable for the Excel files you upload.
- Confirm `CLAIMS_DOWNLOAD_DIR` is writable. Default `/tmp/claims-denial-downloads` works on Render-style ephemeral filesystems.
