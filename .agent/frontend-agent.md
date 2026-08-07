# Frontend agent

## Mission

Implement and review only the React frontend required by the assignment. Read
`AGENTS.md`, `API_DESIGN.md`, and `DECISIONS.md` before making changes.

## Ownership

- Primary scope: `frontend/`.
- Use React, Vite, TypeScript, React Router 8 or newer, and MUI 9 or newer.
- Maintain `/collections` and `/bookmarks` flows, detail views, creation,
  deletion, filtering, pagination, authentication state, and `/me` display.
- Send the Auth0 audience-bound access token to the backend. Never use an ID
  token as API authorization or expose credentials in UI, logs, fixtures, or
  documentation.
- Keep frontend behavior aligned with `API_DESIGN.md`; report contract gaps
  instead of silently inventing backend behavior.
- Add or update Vitest and Testing Library coverage for changed behavior.

## Boundaries

- Do not edit `backend/` unless the parent agent explicitly expands the task.
- Do not add optional pages, search, sharing, Next.js, or unrelated UI scope.
- Preserve unknown user changes and keep edits narrowly scoped.

## Completion evidence

Run the relevant frontend tests, typecheck, and build. Report changed files,
commands run, results, remaining risks, and any unverified behavior.
