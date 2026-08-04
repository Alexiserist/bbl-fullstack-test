# Agent Instructions

## Source of truth and scope

- `Full-Stack-Developer-Test.pdf` is the authoritative assignment.
- Do not add product behavior or technical requirements that are not in the assignment.
- Treat every item marked `TODO` as unresolved. Record and justify the decision before implementing the affected behavior.
- Prefer a smaller, well-understood, well-verified submission over extra scope.
- Do not claim a behavior or security property works unless a runnable test, eval, or specific documented explanation supports it.

## Project goal

Build two integrated services for a personal bookmark manager/private read-later application:

- A signed-in person can save bookmarks and organize them into collections.
- The frontend drives an authenticated backend API.
- Application data is persisted in SQL through Prisma.
- Authentication uses the supplied Auth0 OIDC tenant and Authorization Code flow with PKCE.
- The central invariant is that one person cannot see, edit, or learn that another person's data exists.

The submission must also demonstrate how AI agents were directed, reviewed, corrected, and verified. AI use is required, but all submitted work must be understood and defensible by the candidate.

## Required application scope

### Backend

- Provide `/collections` and `/bookmarks` resources.
- Each resource supports get one, list, create, update (`PUT`), patch (`PATCH`), delete, and filtering.
- Provide `GET /collections/:id/bookmarks`.
- Provide `/me`, returning the current signed-in person.
- A bookmark may belong to one collection or be uncategorized; collections and bookmarks belong to a person.
- Persist data for every route in SQL using Prisma.
- Provide seed data for at least two distinct users.

The assignment suggests these fields as a starting point, but the final schema and any changes must be justified:

- Collection: `id`, `name`, `ownerId`, `createdAt`, `updatedAt`.
- Bookmark: `id`, `url`, `title`, optional `notes`, optional `collectionId`, `ownerId`, `createdAt`, `updatedAt`.

### Frontend

- `/collections`: list the signed-in person's collections, view one, create, and delete.
- `/bookmarks`: list the signed-in person's bookmarks, view details, create, delete, and filter by collection.
- Integrate these pages with the authenticated backend API.

Do not treat the optional Dockerfile, CI/CD pipeline, `/all` page, or full-text search as core requirements. Consider them only after the required scope is solid.

## Technology stack

### Backend stack

- Node.js with TypeScript.
- NestJS for the HTTP layer.
- Prisma ORM.
- SQL persistence.
- OIDC authentication against the supplied Auth0 tenant.
- `TODO`: Choose and document the SQL database/Prisma provider; the assignment does not prescribe one.

### Frontend stack

- React with Vite and TypeScript.
- Do not use Next.js.
- React Router version 8 or newer.
- MUI version 9 or newer.
- `TODO`: Choose and document the frontend OIDC/Auth0 integration library; the assignment does not prescribe one.

## Core privacy and security invariant

Everything is private to the person who created it. There is no public content, shared feed, or ability to browse other users' data. The system is broken if user A can see, change, delete, enumerate, or learn of the existence of user B's collections or bookmarks.

Apply these guardrails to every implementation:

- Derive the current person from the validated bearer credential. Never treat a client-supplied `ownerId` as authority.
- Scope every read and write, including get-one, list, filters, relation queries, updates, patches, and deletes, to the authenticated owner.
- When assigning a bookmark to a collection, verify that the target collection belongs to the same authenticated person.
- Ensure nested access through `GET /collections/:id/bookmarks` preserves the same ownership boundary.
- Avoid response behavior that reveals whether another person's resource exists.
- Use the two-user seed data to prove tenant isolation.
- Keep credentials out of source code, committed configuration, prompts, and transcripts. Use the supplied test account without copying its password into repository documentation or logs.

`TODO`: Define and document the exact not-found/forbidden response strategy used to prevent resource-existence leaks.

## Authentication requirements

- Require OIDC authentication on every backend API route.
- Use Authorization Code flow with PKCE using `S256`. Do not use implicit flow.
- Use the assignment's Auth0 discovery endpoint, client ID, callback URL, logout URL, scopes (`openid profile email`), and available API audience.
- Before selecting the design, inspect the tenant discovery document and JWKS to verify supported flows, token characteristics, and signing algorithms. Do not assume them.
- Accept only an Auth0 access token requested for audience `https://bbl-candidate-test-api` as the API Bearer credential. Do not accept an ID token as API authorization. The rationale and trade-offs are recorded in `README.md` and `DECISIONS.md`.
- `TODO`: Decide how a validated OIDC identity maps to the application's person/`ownerId` record.
- `TODO`: Define the precise token validation rules after inspecting discovery metadata and JWKS.

## Requirements that remain deliberately unresolved

- `TODO`: Decide what happens to bookmarks when their collection is deleted, then document the API contract, trade-offs, implementation, and tests.
- `TODO`: Resolve the statement that a user may want to share a collection. Decide what, if anything, will be implemented; document the choice and its relationship to the privacy invariant. Do not silently add sharing behavior.
- `TODO`: Define remaining filtering parameters and semantics. Bookmark filtering by `collectionId` is selected, but uncategorized-bookmark semantics remain unresolved.
- `TODO`: Define status codes, validation rules, error shape, pagination behavior if any, and exact `PUT` versus `PATCH` semantics in `API_DESIGN.md`.
- `TODO`: Finalize the resource schema and justify any changes to the suggested fields.
- `TODO`: Decide whether any optional bonus will be attempted after the core work is complete.

## Test expectations

Automated tests are required as runnable evidence for the claims made about the application. Tests must go beyond happy paths and emphasize the privacy and authentication boundaries.

At minimum, the verification plan must cover:

- Authentication is required on every backend API route.
- The API access token is accepted only when it satisfies the documented validation rules; missing, malformed, invalid, or otherwise unacceptable credentials and ID tokens are rejected.
- User A cannot read, list, filter, update, patch, delete, relate, or infer the existence of user B's collections or bookmarks.
- A bookmark cannot be attached to another user's collection.
- CRUD, filtering, `/me`, and `GET /collections/:id/bookmarks` follow the documented API contract and persist through Prisma/SQL.
- The chosen collection-deletion and sharing decisions are covered once those `TODO`s are resolved.
- The two required frontend pages work against the authenticated API for their assigned operations.
- The core flow works end to end: sign in with Authorization Code + PKCE, obtain the chosen token(s), call the authenticated API, and persist data.

Mocking part of authentication in tests is allowed only when it is disclosed and the application's real token-validation path is still exercised. Keep verification reproducible and document how to run it.

- `TODO`: Choose the test frameworks, test layers, and any coverage thresholds. The assignment does not prescribe them.
- CI/CD is optional, not a required test deliverable.

## When a requirement is unclear

1. Re-read the relevant assignment section and check the existing repository decisions and API contract.
2. Do not invent a hidden product requirement or silently select an agent default.
3. Mark the item `TODO` while it is unresolved.
4. Record the ambiguity, options, chosen behavior, and trade-offs in `DECISIONS.md`; record API-facing details in `API_DESIGN.md`.
5. Prefer making and documenting a minimal, defensible decision, then back it with tests.
6. Ask the assignment contact only when genuinely blocked. Otherwise decide, document, and preserve evidence of how the agent was steered to the decision.

## Required engineering evidence

- Keep real prompts, plans, and agent-session transcripts under `/transcripts/`; include mistakes and recovery, and redact secrets.
- Add at least one reusable capability under `/.agent/` that was genuinely used, and explain when and why it is invoked.
- Maintain `API_DESIGN.md`, `DECISIONS.md`, `AI_WORKFLOW.md`, and `README.md` as required by the assignment.
- Keep write-ups consistent with the committed code and runnable tests.
- Make meaningful commits as work progresses; do not squash the project into a single finished commit.
- Review and understand all agent-generated code before submission. Be prepared to explain and modify any part of it.
