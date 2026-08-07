# AI Workflow

This implementation follows the assignment constraints in `AGENTS.md` and the
route contract in `API_DESIGN.md`. The working sequence was:

1. Read the assignment and record the privacy, Auth0, Prisma, pagination, and
   testing decisions before writing application code.
2. Build the backend in small slices: Prisma schema and seed, shared response
   handling, authentication/JIT users, owner-scoped services, controllers,
   migrations, and HTTP contract tests.
3. Build the frontend against the documented envelopes with Auth0 React,
   React Router, MUI, and Vite, then add Vitest/Testing Library checks for the
   authenticated page operations.
4. Run typecheck, tests, production builds, and Prisma validation after each
   recovery point.

The repository retains the raw planning conversation under `transcripts/`.
Secrets and raw bearer credentials are not copied into source, prompts, logs,
or transcripts.

## Recovery and limits

An interrupted dependency operation left incomplete packages and temporarily
locked generated output. Missing framework and validation package files were
repaired with normal package reinstalls, Prisma Client was regenerated, and
the checks were rerun. Docker could not be started in the execution
environment because the daemon is inaccessible, so migration, seed execution,
and live SQL verification remain unclaimed until PostgreSQL is running locally.

The tenant discovery document and JWKS were inspected without copying any
credential; they advertise Authorization Code, `S256`, and RSA `RS256` keys.
The real audience-bound access token is not available in the repository, so
the client-claim choice remains a configuration TODO until the candidate
obtains one from the supplied tenant. The `/userinfo` timeout is now fixed at
1500 ms, and the test layers are recorded in ADR-019.

## Reusable capability

`.agent/owner-scope-review.md` is the reusable review checklist used while
auditing each controller and service. It is invoked before adding or changing a
resource route to check owner-scoped queries, relation validation, uniform
404 behavior, and response-contract coverage.
