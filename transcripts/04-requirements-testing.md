# Requirements testing session

Date: 2026-08-07

## Candidate direction

> I want to test function that was a requirement and work correctly

The request was interpreted conservatively: strengthen runnable evidence for
behaviors already required by `Full-Stack-Developer-Test.pdf` and `AGENTS.md`.
No optional feature or new product behavior was added.

## Plan used

1. Run the existing backend and frontend suites and both TypeScript checks to
   establish a clean baseline.
2. Compare named tests with the assignment's authentication, privacy,
   validation, pagination, update, profile, and persistence expectations.
3. Add high-value missing cases at the Nest/Supertest boundary and service
   layer, plus the frontend current-user fallback checks.
4. Run targeted tests immediately after each edit, then run all tests, builds,
   and Prisma schema validation.
5. Run the opt-in PostgreSQL integration test only when the local Compose
   service is confirmed healthy.

## Corrections and review notes

- The first PostgreSQL test command failed before any assertion because Jest
  did not automatically load `backend/.env`, leaving `DATABASE_URL` undefined.
  The test was rerun with Node's `--env-file=.env` option and passed. The README
  command was corrected to make this lifecycle reproducible without revealing
  the connection string.
- Existing modified frontend dependency files and agent files were treated as
  prior work and were not reverted.
- The additional assertions passed against the existing product code, so no
  application behavior was changed merely to make the tests pass.

## Verification result

- Backend default Jest suite: 81 passed; the one opt-in database test is skipped
  by the default command.
- Backend PostgreSQL/Prisma integration test: 1 passed against PostgreSQL 18.4.
- Frontend Vitest suite: 35 passed across eight files.
- Backend and frontend production builds: passed.
- Prisma schema validation: passed.
- The Vite build still reports the documented non-blocking large-chunk warning.

The added cases cover all API routes requiring authentication, the identical
missing/other-owner 404 contract across protected access paths, relation
ownership, server-controlled and unknown fields, disallowed URL schemes,
invalid filters and pagination, PUT/PATCH semantics, JWKS and token-claim edge
cases, concurrent user provisioning, `/userinfo` timeout behavior, `/me`
response fields, and frontend name/email/generic-label fallbacks.
