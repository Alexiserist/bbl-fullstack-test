# BBL Full-Stack Developer Test

The repository contains the NestJS/Prisma backend and the React/Vite frontend.
The assignment's private-owner invariant applies to every route: a request can
only read or change resources owned by the authenticated local user.

See [API_DESIGN.md](API_DESIGN.md) for the response contract and route details,
[DECISIONS.md](DECISIONS.md) for recorded design choices, and [AGENTS.md](AGENTS.md)
for the assignment constraints.

## Local PostgreSQL

The local database uses PostgreSQL 18.4 through Docker Compose. Copy `.env.example` to `.env` if `.env` is not already present, then review the local-only credentials.

Start the database:

```bash
docker compose up -d postgres
```

Check its health:

```bash
docker compose ps
```

Stop the database:

```bash
docker compose down
```

Prisma uses `DATABASE_URL` from `.env`. From the repository root, copy the
example first if needed:

```powershell
Copy-Item .env.example .env
```

Then initialize and seed the backend database (the commands below run with the
backend package as the working directory):

```powershell
Set-Location backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
```

The Prisma CLI reads `DATABASE_URL` from the backend working directory. If the
repository `.env` is not also available there, set `DATABASE_URL` in the shell
before running Prisma commands. The backend also reads its Auth0 settings from
this same `backend/.env` file. `frontend/.env` is not loaded by the backend; an
existing backend environment containing only database settings causes every
authenticated API request to return `401 Unauthorized` because
`AUTH0_CLIENT_ID` is missing. Merge the Auth0 settings from
`backend/.env.example` into an existing local file and do not commit
credentials.

Run the backend:

```powershell
npm.cmd run start:dev
```

The API listens on `PORT` (default `3001`). `start` and `start:prod` run the
compiled entry point after `npm.cmd run build`.

Run verification:

```powershell
npm.cmd run typecheck
npm.cmd test -- --runInBand
npm.cmd run build
```

The backend Jest suite includes real `jose` JWT verification against a
controlled JWKS server, `/userinfo` provisioning branches, Nest HTTP contract
tests, generic privacy errors, pagination, and owner-scoped service behavior.
The HTTP and token tests use controlled test doubles; PostgreSQL persistence
verification requires the Docker Compose database.

The frontend uses the separate package:

```powershell
Set-Location ..\frontend
Copy-Item .env.example .env
# Set VITE_AUTH0_CLIENT_ID to the supplied client ID in frontend/.env.
npm.cmd install
npm.cmd run dev
```

The signed-in UI provides:

- paginated collections with name filtering and lazy, collapsible bookmark
  previews;
- reusable MUI dialogs for creating and editing complete bookmark data;
- bookmark filtering by all items, uncategorized items, or one owned
  collection through a searchable MUI dropdown;
- page-size selectors for collection, bookmark, collection-detail, and
  expanded-collection lists;
- create, edit, and delete actions from list and detail views, with accessible
  confirmations and consistent feedback; and
- collection selectors that follow every API page instead of silently stopping
  at the first 100 collections.

Accordion previews default to five bookmarks per nested page, while full list
and detail routes default to 20. Each list can select 5, 10, 20, 50, or 100
items per page and resets to page 1 when that value changes. Bookmark title/URL
search is not implemented because it is outside the core API contract.

Frontend checks are:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The opt-in SQL integration test runs after PostgreSQL is available and the
migrations are deployed:

```powershell
Set-Location ..\backend
npm.cmd run prisma:migrate:deploy
$env:RUN_DB_TESTS='true'
node --env-file=.env node_modules/jest/bin/jest.js --runInBand src/prisma/prisma.integration.spec.ts
```

Without `RUN_DB_TESTS=true`, the database suite is skipped so the default
checks do not require a running Docker daemon.

The browser uses `@auth0/auth0-react` with the API audience and
`openid profile email` scope. The SDK handles the Authorization Code + PKCE
browser flow; the API client sends only the audience-bound access token to the
backend. The SDK manages its cache in browser local storage so authentication
survives a page reload; application code never reads or writes cached tokens
directly. Refresh tokens remain disabled until rotation support is confirmed
for the supplied Auth0 SPA client. This persistence choice and its XSS trade-off
are recorded in `DECISIONS.md`. Configure the Auth0 callback and logout URLs to
match `frontend/.env.example` and the tenant application settings:

- Allowed Callback URL: `http://localhost:3000/callback`
- Allowed Logout URL: `http://localhost:3000`
- Requested scope: `openid profile email`

## Authentication decision

The backend accepts only an Auth0 access token issued for the API audience as its Bearer credential, because access tokens are audience-bound credentials intended for APIs while ID tokens are intended for the client application and must not authorize API access.

Set `AUTH0_CLIENT_ID` before using authenticated routes. `AUTH0_CLIENT_CLAIM`
defaults to `azp`; the real audience-bound access token must still be inspected
to confirm whether this tenant issues `azp` or `client_id`, then the matching
value should be set explicitly. The initial `/userinfo` timeout is 1500 ms;
failures leave optional profile fields null and do not reject the request.

The optional Dockerfile, CI/CD pipeline, `/all` page, full-text search, and
sharing work are deliberately deferred. The frontend currently uses the
latest React Router package available in the configured registry (7.18.2);
the assignment's stated 8-or-newer requirement is recorded as a dependency
availability TODO in `DECISIONS.md`.
