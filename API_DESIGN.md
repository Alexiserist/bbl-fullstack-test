# API Design

Status: Draft contract. No application code has been implemented.

## Security invariants

- Every backend API route requires a valid Auth0 access token in `Authorization: Bearer <access-token>`.
- ID tokens are not accepted as API authorization.
- Every collection and bookmark query is scoped to the authenticated owner, including lists, filters, get-by-ID, relation lookups, updates, patches, and deletes.
- The authenticated owner is derived from the validated token and local-user mapping, never from request data.
- `ownerId` is server-controlled and excluded from all create and update inputs. A request containing `ownerId` must be rejected rather than used or silently applied.
- A bookmark may reference only a collection belonging to the same authenticated owner.
- Cross-owner requests must not reveal whether another owner's resource exists.

`TODO`: Decide the exact mapping from the validated Auth0 identity to the local user record.

`TODO`: Decide the exact not-found/forbidden response strategy without leaking resource existence.

## Authentication

All routes use the access-token decision in `DECISIONS.md`:

- Issuer: `https://dev-yg.us.auth0.com/`
- Required audience: `https://bbl-candidate-test-api`
- JWKS: `https://dev-yg.us.auth0.com/.well-known/jwks.json`

`TODO`: Finalize the accepted signing algorithm and precise claim-validation rules after inspecting a real audience-bound access token.

## Current user

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Return the authenticated person's local user profile. |

`TODO`: Define the `/me` response fields and decide whether the first authenticated request provisions the local user or requires a pre-existing record.

## Collections

Every operation applies only to collections owned by the authenticated person.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/collections` | List the current person's collections. Filtering is supported; exact parameters remain `TODO`. |
| `POST` | `/collections` | Create a collection for the current person. The server assigns `ownerId`. |
| `GET` | `/collections/:id` | Get one current-person collection by ID. |
| `PUT` | `/collections/:id` | Update one current-person collection. Exact replacement semantics remain `TODO`. |
| `PATCH` | `/collections/:id` | Partially update mutable fields of one current-person collection. `ownerId` cannot be changed. |
| `DELETE` | `/collections/:id` | Delete one current-person collection. Bookmark on-delete behavior remains `TODO`. |
| `GET` | `/collections/:id/bookmarks` | List bookmarks in one collection owned by the current person. |

Suggested response fields: `id`, `name`, `ownerId`, `createdAt`, `updatedAt`.

Writable fields begin with `name`; final validation and schema constraints remain `TODO`.

## Bookmarks

Every operation applies only to bookmarks owned by the authenticated person.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/bookmarks` | List the current person's bookmarks. Supports filtering by `collectionId`. |
| `POST` | `/bookmarks` | Create a bookmark for the current person. The server assigns `ownerId`. |
| `GET` | `/bookmarks/:id` | Get one current-person bookmark by ID. |
| `PUT` | `/bookmarks/:id` | Update one current-person bookmark. Exact replacement semantics remain `TODO`. |
| `PATCH` | `/bookmarks/:id` | Partially update mutable fields of one current-person bookmark. `ownerId` cannot be changed. |
| `DELETE` | `/bookmarks/:id` | Delete one current-person bookmark. |

Collection filtering uses:

```http
GET /bookmarks?collectionId=<collection-id>
```

The required nested form is also supported:

```http
GET /collections/:id/bookmarks
```

Both forms must first verify that the referenced collection belongs to the authenticated person. `TODO`: Define how the filter represents uncategorized bookmarks and how invalid or inaccessible collection IDs are reported.

Suggested response fields: `id`, `url`, `title`, optional `notes`, optional `collectionId`, `ownerId`, `createdAt`, `updatedAt`.

Writable fields begin with `url`, `title`, optional `notes`, and optional `collectionId`; final validation and schema constraints remain `TODO`.

## Owner changes and future administration

There is no admin role or cross-owner operation in the assignment. The current API therefore has no route, claim, or payload field that can override or transfer `ownerId`.

`TODO`: Consider an administrative ownership capability only if it becomes an explicit product requirement. It would require a separate authorization model and API contract; it must not be implemented as a normal `PATCH` field.

## Persistence

All route data is persisted in SQL through Prisma. Seed data must include at least two distinct users so ownership isolation can be tested.

## Contract details still unresolved

- `TODO`: Success status codes for create, update, patch, and delete.
- `TODO`: Error status codes and the shared error response shape.
- `TODO`: Exact `PUT` replacement versus update behavior.
- `TODO`: Validation rules and schema constraints.
- `TODO`: Remaining collection and bookmark filters, including uncategorized bookmarks.
- `TODO`: Pagination behavior, if any.
- `TODO`: Collection deletion behavior for its bookmarks.
- `TODO`: Sharing behavior from the under-specified product requirement.

## Required verification

Automated tests must prove authentication and owner isolation across every endpoint and method. At minimum, user A must be unable to list, filter, get, create under, update, patch, delete, or infer the existence of user B's resources. Tests must also reject attempts to submit or change `ownerId` and attempts to attach a bookmark to another user's collection.
