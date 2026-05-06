# Project Context

This directory is the canonical documentation hub for the repo.

If you are a future human or LLM picking this project back up, read files in this order:

1. [STATE_HANDOFF.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/STATE_HANDOFF.md)
2. [ISSUES_AND_DISCREPANCIES.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/ISSUES_AND_DISCREPANCIES.md)
3. [backend/README.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/backend/README.md)
4. [frontend/README.md](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/project-context/frontend/README.md)

## What Each File Is For

- `STATE_HANDOFF.md`
  Latest repo state, branch context, architecture, run flow, recent changes, and current handoff notes.
- `ISSUES_AND_DISCREPANCIES.md`
  Active logic gaps, expected-vs-generated output differences, conservative fallback policy, and a backlog of business-rule questions to resolve later.
- `backend/README.md`
  Compact backend map: pipeline, key modules, rules brain integration, current logic posture.
- `frontend/README.md`
  Compact frontend map: route structure, state flow, current limitations, and backend integration expectations.

## Directory Design

- Keep docs short enough to scan quickly.
- Put stable facts in the component docs.
- Put volatile state in `STATE_HANDOFF.md`.
- Put unresolved logic and future investigation items in `ISSUES_AND_DISCREPANCIES.md`.
- Prefer replacing stale sections over appending long historical narratives.

## Context Compaction Rules

- Put the most important current truth near the top of each file.
- Use short sections and flat bullets.
- Keep exact counts, branch names, and file paths when they matter.
- Remove obsolete steps once they are no longer useful.
- When a question is unresolved, state the current safe behavior instead of guessing.

## Current Safety Rule

When business intent is unclear, prefer `Needs Manual Review` over a confident but wrong automated outcome.
