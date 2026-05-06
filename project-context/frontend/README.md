# Frontend Context

## Role

The frontend is an operations UI around the backend claims processor.

It currently provides:

- navigation shell
- upload flow
- review/run validation flow
- output viewer shell
- future AI/settings scaffolding

## Current Stack

- TanStack Start
- React
- Vite

## Important Files

- [AppContext.tsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/frontend/src/context/AppContext.tsx)
  shared frontend state and validation trigger flow
- [validate.tsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/frontend/src/routes/validate.tsx)
  run-validation screen
- [upload.tsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/frontend/src/routes/upload.tsx)
  upload UX
- [output.tsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/frontend/src/routes/output.tsx)
  output shell and placeholder table
- [Sidebar.tsx](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/frontend/src/components/layout/Sidebar.tsx)
  app navigation

## Current Limitation

The frontend does not yet show real processed rows because the backend returns a binary Excel file rather than structured JSON.

## Recommended Next Frontend Step

Prefer adding a backend JSON response path for processed rows instead of parsing Excel in-browser.

That will make it easier to:

- render the output table
- power the future AI analyst experience
- debug row-level logic
- feed structured data back into future LLM workflows

## Local Run Notes

Use Node 22:

```bash
export PATH="/Users/adi/.nvm/versions/node/v22.18.0/bin:$PATH"
cd "/Users/adi/Desktop/Coding/Misc/Claims Denial/frontend"
npm install
npm run dev
```

Expected local URL:

- `http://localhost:8080`

## Current UI State

- upload and validation flow is functional
- output page is partly placeholder-driven
- AI analyst/settings pages are mostly scaffolding
- this branch is a strong frontend foundation, but not yet the final analyst workflow
