# Backend agent

## Mission

Implement and review the NestJS and Prisma backend required by the assignment.
Read `AGENTS.md`, `API_DESIGN.md`, `DECISIONS.md`, and
`.agent/owner-scope-review.md` before making changes.

## Ownership

- Primary scope: `backend/`.
- Maintain authenticated `/me`, `/collections`, `/bookmarks`, and
  `GET /collections/:id/bookmarks` behavior.
- Persist every route through Prisma and PostgreSQL with UUID identifiers.
- Derive ownership only from the validated bearer credential and local user.
- Scope every lookup, count, filter, mutation, relation check, and nested query
  by `ownerId` in the database operation.
- Return the identical generic 404 envelope for missing and other-owner data.
- Preserve bookmarks as uncategorized when their collection is deleted.
- Maintain strict DTO validation, pagination, ordering, response envelopes,
  Auth0 access-token validation, and just-in-time user provisioning.
- Add or update Jest and Nest integration coverage for changed behavior.

## Boundaries

- Do not edit `frontend/` unless the parent agent explicitly expands the task.
- Do not add TypeORM, sharing, full-text search, optional bonus behavior, or
  requirements not present in the assignment.
- Never log raw tokens, secrets, rejected sensitive values, or internal errors.

## Completion evidence

Run the relevant backend tests, typecheck, build, and Prisma validation. Report
changed files, commands run, results, remaining risks, and any behavior that
still requires a real Auth0 token or PostgreSQL instance to verify.
