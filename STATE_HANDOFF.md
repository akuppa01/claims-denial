# STATE HANDOFF

## Repo Snapshot

- Repo: `claims-denial`
- Active branch: `feat/agentic-ui` (latest UI work — branched from `divestiture-additions`)
- Date: `2026-05-06`
- App shape: monorepo — FastAPI backend + TanStack Start (React SSR) frontend

---

## Branch Hierarchy

```
main
└── divestiture-additions   ← divestiture backend logic (131 tests passing)
    └── feat/agentic-ui     ← full frontend redesign (THIS BRANCH, latest)
```

---

## What Was Done on `feat/agentic-ui`

### Complete Frontend Redesign

Rebuilt the entire frontend UI into an enterprise AI operations dashboard. The original single-page app (`routes/index.tsx`) has been replaced with a full multi-page app with sidebar navigation. The existing backend (`POST /process-claims`) and upload/validation flow are fully preserved.

### New File Structure

```text
frontend/src/
├── context/
│   └── AppContext.tsx          ← NEW: global state (files, validation, output, model selection)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         ← NEW: collapsible dark navy sidebar
│   │   └── TopBar.tsx          ← NEW: top header with status pills
│   └── app/
│       ├── StatCard.tsx        ← NEW: metric card component
│       ├── WorkflowStep.tsx    ← NEW: step status indicator
│       ├── LogsPanel.tsx       ← NEW: dark terminal-style logs panel
│       ├── OutputTable.tsx     ← NEW: output table with filters
│       ├── AIAssistantPanel.tsx ← NEW: AI chat mock (Coming Soon)
│       └── PlaceholderPage.tsx  ← NEW: reusable placeholder page
├── routes/
│   ├── __root.tsx              ← UPDATED: sidebar layout + AppProvider wrapper
│   ├── index.tsx               ← UPDATED: redirects to /dashboard
│   ├── dashboard.tsx           ← NEW: stats dashboard + getting started guide
│   ├── upload.tsx              ← NEW: upload page with 6 file cards + progress bar
│   ├── validate.tsx            ← NEW: review + run validation + workflow + logs
│   ├── output.tsx              ← NEW: output viewer + AI assistant panel
│   ├── ai-analyst.tsx          ← NEW: AI analyst mock page
│   ├── help.tsx                ← NEW: placeholder
│   ├── feedback.tsx            ← NEW: placeholder
│   └── settings/
│       ├── models.tsx          ← NEW: LLM model selection (GPT-4o, Claude, Gemini)
│       ├── api-keys.tsx        ← NEW: API keys (backend-only explainer)
│       └── usage.tsx           ← NEW: usage/tokens stats
└── routeTree.gen.ts            ← AUTO-UPDATED by Vite plugin on dev server start
```

### Key Design Decisions

- **Sidebar**: Dark navy (`bg-slate-900`), collapsible, shows file upload status pill
- **Layout**: Fixed sidebar + scrollable content area, white top bar
- **Colors**: Blue-600 primary, green for success, amber for warnings, slate for muted
- **State**: Single `AppContext` holds all upload/validation/output state across pages
- **Output viewer**: Shows mock/placeholder rows + download button (no xlsx parsing needed)
- **AI panel**: Clickable prompt chips, "Coming Soon" badge, friendly disabled responses
- **LLM models**: Stored in `selectedModel` local state, not sent to backend yet

---

## Running the App

### Node version requirement
Frontend requires Node v20+ (v22 recommended). Use:
```bash
export PATH="/Users/adi/.nvm/versions/node/v22.18.0/bin:$PATH"
```

### Start backend
```bash
cd "/Users/adi/Desktop/Coding/Misc/Claims Denial/backend"
python3 -m uvicorn app.main:app --reload --port 8000
```
Health check: `curl http://localhost:8000/health` → `{"status":"ok",...}`

### Start frontend
```bash
export PATH="/Users/adi/.nvm/versions/node/v22.18.0/bin:$PATH"
cd "/Users/adi/Desktop/Coding/Misc/Claims Denial/frontend"
npm install   # if node_modules missing or stale
npm run dev
```
Opens at: `http://localhost:8080` → auto-redirects to `/dashboard`

---

## Frontend Routes

| Route | Page | Status |
|-------|------|--------|
| `/` | → redirects to `/dashboard` | ✅ |
| `/dashboard` | Stats dashboard + getting started | ✅ |
| `/upload` | Upload 6 Excel files | ✅ functional |
| `/validate` | Review files + run validation pipeline | ✅ functional |
| `/output` | Output table viewer + AI panel | ✅ (mock table data) |
| `/ai-analyst` | AI Analyst (Coming Soon) | ✅ mock |
| `/settings/models` | LLM model selection | ✅ mock |
| `/settings/api-keys` | API key explainer | ✅ mock |
| `/settings/usage` | Usage/token stats | ✅ mock |
| `/help` | Help placeholder | ✅ placeholder |
| `/feedback` | Feedback placeholder | ✅ placeholder |

---

## What Still Needs Backend Work

1. **Output table rows are mock/placeholder data** — the backend returns a binary Excel blob. To show real rows in the output table, either:
   - Add a JSON endpoint `POST /process-claims/json` that returns structured rows alongside the Excel
   - Or parse the Excel in the browser with the `xlsx` npm package (not yet installed)

2. **AI Analyst is not connected** — no LLM integration yet. The `selectedModel` in AppContext is stored locally only. To wire it up:
   - Add `POST /ai/chat` backend endpoint that proxies to the selected LLM using env-var API keys
   - Connect the `AIAssistantPanel` input to that endpoint

3. **API keys are display-only** — the `/settings/api-keys` page explains backend-only key storage. The backend `.env` integration for LLM keys is not yet implemented.

4. **Token/usage tracking is mock** — real tracking requires the AI Analyst to be wired up first.

---

## Backend Facts (unchanged from divestiture-additions)

- Endpoint: `POST /process-claims` (multipart form, 6 fields)
- Response: binary Excel blob (`.xlsx`)
- 23 output columns (when using updated rules brain)
- 131 backend tests passing

### Form field names
- `denial_records`
- `contracts_data`
- `customer_master`
- `material_master`
- `pricing_data`
- `rules_brain`

---

## Test Data Files

- Denial/master/pricing data: `/Users/adi/Downloads/DenialRecords (2)/`
- Updated rules brain: `backend/tests/fixtures/Claims_AI_Rules_Brain_Updated.xlsx`
- Desktop copy: `/Users/adi/Desktop/Claims_AI_Rules_Brain_Updated.xlsx`

Upload all 6 files via the Upload Claims page, then run validation from the Validation Runs page.

---

## Known Issues / TODOs

- [ ] Output Viewer shows placeholder mock rows, not real validated data
- [ ] AI Analyst chat is disabled (Coming Soon)
- [ ] Sidebar `/help` and `/feedback` are placeholder pages
- [ ] Token tracking on Usage page is all mock (`—`)
- [ ] The `routeTree.gen.ts` is auto-generated — do not manually edit it; Vite plugin updates it on dev server start

---

## Divestiture Backend Work (from divestiture-additions)

See the original handoff notes below for full details on the divestiture logic, test results, and identified discrepancies with OutputFile.xlsx.

### Unresolved discrepancies

1. `Denial_Decision` logic for divestiture rows (Acceptable Denial vs Resubmission Candidate)
2. `Transition_Period_Flag` mismatch for ~4 rows (CLM900013/14/16/18)
3. `Agent_Status: "Closed - Research Complete"` for valid-denial non-divestiture rows — needs `Confirms_Denial_Valid` flag in Scenarios sheet

---

## Important Constraints

- Do not expose API keys in frontend code
- Do not rewrite backend processing pipeline without explicit instruction
- The 6 file fields must keep their exact names (`denial_records`, `contracts_data`, etc.)
- TanStack Router route tree is auto-generated — add routes by creating files in `src/routes/`, not by editing `routeTree.gen.ts`
- Always use Node v22 to run frontend dev server

## Most Relevant Files

- `frontend/src/context/AppContext.tsx` — all shared state + `runValidation()` logic
- `frontend/src/routes/validate.tsx` — run validation UI
- `frontend/src/routes/upload.tsx` — file upload UI
- `frontend/src/components/layout/Sidebar.tsx` — navigation
- `backend/app/main.py` — FastAPI entrypoint
- `backend/app/processor.py` — divestiture logic hub
- `backend/tests/fixtures/Claims_AI_Rules_Brain_Updated.xlsx` — use as rules_brain input
