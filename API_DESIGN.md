# API Design

Status: Core backend and frontend implementation are being completed against
this contract. Live Auth0 sign-in and PostgreSQL integration remain environment
dependent and are only claimed when their runnable checks pass.

## Security invariants

- Every backend API route requires a valid Auth0 access token in `Authorization: Bearer <access-token>`.
- ID tokens are not accepted as API authorization.
- Every collection and bookmark query is scoped to the authenticated owner, including lists, filters, get-by-ID, relation lookups, updates, patches, and deletes.
- The authenticated owner is derived from the validated token and local-user mapping, never from request data.
- `ownerId` is server-controlled and excluded from all create and update inputs. A request containing `ownerId` must be rejected rather than used or silently applied.
- A bookmark may reference only a collection belonging to the same authenticated owner.
- Cross-owner requests must not reveal whether another owner's resource exists.

The backend resolves the local user on every authenticated route using the unique combination of the validated token's issuer (`iss`) and subject (`sub`). If no matching user exists, it creates one just in time with a Prisma-generated UUID. That UUID is the `ownerId` used by collections and bookmarks.

Local-user provisioning must use an atomic upsert or equivalent unique-constraint recovery so simultaneous first requests cannot create duplicate users. Seeded users are test fixtures and remain separate from the real Auth0 account. Optional email and name fields never determine identity or ownership.

## Privacy-preserving not-found behavior

Every owner-scoped lookup queries by both resource ID and authenticated `ownerId`. If no owned row is found, the API returns the same `404 Not Found` status and generic response body whether the resource is absent globally or exists under another owner. The API does not perform a second unscoped lookup, return `403 Forbidden`, or disclose which condition occurred.

This rule applies to:

- `GET`, `PUT`, `PATCH`, and `DELETE` by collection or bookmark ID.
- The parent collection in `GET /collections/:id/bookmarks`.
- A `collectionId` used to filter bookmarks.
- A non-null `collectionId` supplied when creating, replacing, or patching a bookmark.

An owned collection with no bookmarks returns a successful empty list. A missing or other-owner collection returns the exact generic `404 Not Found` envelope defined under Response contract.

## Authentication

All routes use the access-token decision in `DECISIONS.md`:

- Issuer: `https://dev-yg.us.auth0.com/`
- Required audience: `https://bbl-candidate-test-api`
- JWKS: `https://dev-yg.us.auth0.com/.well-known/jwks.json`

The backend accepts only an access token in `Authorization: Bearer <token>`. It validates:

- Signature using the public key selected by `kid` from the tenant JWKS.
- An explicit `RS256` algorithm allowlist; `none`, symmetric, and all other algorithms are rejected.
- Exact issuer `https://dev-yg.us.auth0.com/`.
- An audience string or array containing `https://bbl-candidate-test-api`.
- Required `exp`, which must not be expired after applying 60 seconds of clock tolerance.
- Required `iat`, which must not be more than 60 seconds in the future.
- Optional `nbf`, which must not be more than 60 seconds in the future when present.
- A non-empty `sub`.
- The expected frontend client identifier. Depending on the confirmed token profile, `azp` or `client_id` must equal the assignment client ID.

JWKS keys are cached according to the endpoint's cache behavior. An unknown `kid` triggers one refresh; if the key remains unknown, validation fails. Custom API scopes are not required because none are defined by the assignment.

Every validation failure and every ID token presented as an API credential receives a generic `401 Unauthorized`. Raw tokens must never be logged.

The tenant discovery document and JWKS were inspected on 2026-08-07. Discovery
advertises `authorization_code`, `S256`, and the configured issuer, userinfo,
token, and JWKS endpoints; the published signing keys are RSA `RS256` keys.
The repository does not contain a real audience-bound access token, so the
exact client claim remains an explicit `TODO`: configure `AUTH0_CLIENT_CLAIM`
to the observed `azp` or `client_id` value after obtaining one from the
assignment tenant. The backend defaults to `azp` and never accepts a token
without the configured matching client claim.

## Current user

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Return the authenticated person's local user profile. |

`GET /me` uses the same just-in-time user resolution as every authenticated route.

Successful response fields:

```json
{
  "id": "<local-user-uuid>",
  "email": null,
  "name": null,
  "createdAt": "<ISO-8601 timestamp>",
  "updatedAt": "<ISO-8601 timestamp>"
}
```

`email` and `name` are nullable. During initial provisioning of a newly created local user, the backend attempts one Auth0 `/userinfo` request using the validated access token and a short timeout. If it succeeds, available email and name values are persisted. If it fails or the claims are absent, the fields remain null and the authenticated request continues. Existing users do not call `/userinfo` again, and continuous profile synchronization is not implemented.

The frontend displays `name`, falling back to `email`, then to a generic signed-in label. Tokens, `authIssuer`, and `authSubject` are not returned.

The exact `/userinfo` timeout is 1500 ms. A timeout, non-success response,
network failure, malformed body, or unavailable optional profile values leaves
the nullable fields empty and does not reject the authenticated request.

## Collections

Every operation applies only to collections owned by the authenticated person.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/collections` | List the current person's collections, optionally filtered by collection name. |
| `POST` | `/collections` | Create a collection for the current person. The server assigns `ownerId`. |
| `GET` | `/collections/:id` | Get one current-person collection by ID. |
| `PUT` | `/collections/:id` | Replace the complete writable representation of one current-person collection. |
| `PATCH` | `/collections/:id` | Update only supplied writable fields of one current-person collection. |
| `DELETE` | `/collections/:id` | Delete one current-person collection and make its bookmarks uncategorized by setting their `collectionId` to null. |
| `GET` | `/collections/:id/bookmarks` | List bookmarks in one collection owned by the current person. |

Response fields: `id`, `name`, `ownerId`, `createdAt`, `updatedAt`.

The only writable field is `name`. Whenever the operation requires or supplies it, it must be a string that is trimmed before persistence and contains 1–100 characters after trimming. Null and blank values are invalid. Duplicate names belonging to the same or different owners are allowed.

Collection filtering uses:

```http
GET /collections?name=<text>
```

The server trims `name`, requires 1–100 characters, and performs a case-insensitive substring match within the authenticated owner's collections. Omitting `name` applies no name filter. A blank or invalid value receives the standard validation error.

Deleting a collection removes the collection row but preserves its bookmarks. Every bookmark related to that collection has `collectionId` set to null atomically through the Prisma/PostgreSQL relation behavior. The delete lookup remains owner-scoped, and the operation must not affect another owner's collections or bookmarks. A successful delete returns `200 OK` with `data: null` in the standard success envelope.

## Bookmarks

Every operation applies only to bookmarks owned by the authenticated person.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/bookmarks` | List the current person's bookmarks, optionally filtered by an owned collection or uncategorized state. |
| `POST` | `/bookmarks` | Create a bookmark for the current person. The server assigns `ownerId`. |
| `GET` | `/bookmarks/:id` | Get one current-person bookmark by ID. |
| `PUT` | `/bookmarks/:id` | Replace the complete writable representation of one current-person bookmark. |
| `PATCH` | `/bookmarks/:id` | Update only supplied writable fields of one current-person bookmark. |
| `DELETE` | `/bookmarks/:id` | Delete one current-person bookmark. |

Collection filtering uses:

```http
GET /bookmarks?collectionId=<collection-id>
```

Uncategorized filtering uses:

```http
GET /bookmarks?uncategorized=true
```

The required nested form is also supported:

```http
GET /collections/:id/bookmarks
```

The `collectionId` filter and nested form first verify that the referenced collection belongs to the authenticated person. A malformed UUID receives `400 VALIDATION_ERROR`; a missing or other-owner collection receives the uniform `404 NOT_FOUND` response. An owned collection with no bookmarks succeeds with an empty data array.

When present, `uncategorized` supports only the literal `true` and selects bookmarks whose `collectionId` is null. Omitting both filters returns all of the authenticated owner's categorized and uncategorized bookmarks. `collectionId` and `uncategorized=true` are mutually exclusive; combining them receives `400 VALIDATION_ERROR`.

The core API does not add URL search, title search, full-text search, owner filters, or multiple collection IDs.

## Lists and pagination

All list routes use offset pagination:

```http
GET /collections?page=1&pageSize=20
GET /bookmarks?page=1&pageSize=20
GET /collections/:id/bookmarks?page=1&pageSize=20
```

Filtering parameters combine with pagination parameters on the applicable route. The server applies authenticated-owner scoping and filters before both the count and page query.

Pagination parameters:

| Parameter | Default | Validation |
| --- | --- | --- |
| `page` | `1` | Integer greater than or equal to 1. |
| `pageSize` | `20` | Integer from 1 through 100 inclusive. |

Invalid, non-integer, or out-of-range values receive `400 VALIDATION_ERROR`. Every list is ordered by `createdAt DESC`, then `id DESC` as a deterministic tie-breaker.

List responses use:

```json
{
  "statusCode": 200,
  "message": "Bookmarks retrieved",
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

`total` counts rows under the same owner and filters. `totalPages` is `ceil(total / pageSize)`, or 0 when total is 0. A page beyond the available results returns `200 OK` with an empty `data` array and metadata retaining the requested page and actual totals. An inaccessible parent or filtered collection still returns the privacy-preserving 404 before pagination.

The Prisma schema must include conceptual composite indexes on collection `(ownerId, createdAt DESC, id DESC)`, bookmark `(ownerId, createdAt DESC, id DESC)`, and bookmark `(ownerId, collectionId, createdAt DESC, id DESC)`. Trigram and full-text indexes remain outside core scope.

## Nested collection bookmarks

The assignment-required nested route is:

```http
GET /collections/:id/bookmarks?page=1&pageSize=20
```

Nesting represents relational navigation. Bookmarks remain independent SQL rows containing nullable `collectionId`; they are not embedded in a collection JSON or database record.

Request behavior:

1. Validate the path `id` as a UUID. A malformed ID receives `400 VALIDATION_ERROR`.
2. Resolve the parent with both `id` and authenticated `ownerId`. A missing or other-owner collection receives the identical generic 404.
3. Count and select bookmarks with both that `collectionId` and the authenticated `ownerId`.
4. Apply `createdAt DESC, id DESC` ordering and standard pagination.

The route accepts only `page` and `pageSize` query parameters. It rejects `collectionId`, `uncategorized`, collection-name filters, and other unsupported query parameters with `400 VALIDATION_ERROR` because the path already selects the collection.

An owned collection with no bookmarks returns `200 OK`, an empty `data` array, and zero totals. For the same owned collection, page, and page size, this route and `GET /bookmarks?collectionId=<id>` return equivalent bookmark data and metadata.

Only nested GET is implemented. Create, PUT, PATCH, and DELETE remain under `/bookmarks`. After a collection is deleted, this nested route returns the generic 404; the preserved former bookmarks can be retrieved with `GET /bookmarks?uncategorized=true`.

Response fields: `id`, `url`, `title`, nullable `notes`, nullable `collectionId`, `ownerId`, `createdAt`, `updatedAt`.

Writable fields and validation:

- `url`: an absolute `http` or `https` URL, at most 2,048 characters. Other schemes, including `javascript`, `data`, `file`, and `vbscript`, are invalid.
- `title`: a string that is trimmed before persistence and contains 1–300 characters after trimming. Null and blank values are invalid.
- `notes`: a string of at most 10,000 characters or null. An omitted, null, or blank value normalizes to null when the operation permits omission.
- `collectionId`: a UUID or null. A non-null value must identify a collection owned by the authenticated person.

Duplicate bookmark URLs are allowed.

## PUT and PATCH semantics

`PUT` replaces the complete writable representation:

- Collection `PUT` requires `name`.
- Bookmark `PUT` requires `url` and `title`.
- Omitted bookmark `notes` and `collectionId` become null.
- Explicit null is accepted for bookmark `notes` and `collectionId` but not for collection `name` or bookmark `url` and `title`.

`PATCH` updates only fields present in the request:

- The body must contain at least one writable field; an empty object is invalid.
- Omitted fields retain their existing values.
- Explicit null clears bookmark `notes` or `collectionId`.
- Collection `name` and bookmark `url` and `title` cannot be null when supplied.
- Because `name` is the collection's only writable field, collection `PATCH` currently requires it and has the same payload shape as collection `PUT`; the semantic distinction remains partial versus complete replacement.

Both methods apply common validation, query the target by its ID and authenticated `ownerId`, and reject all server-controlled or unknown fields. A non-null bookmark `collectionId` requires the same owner-scoped collection validation as creation. A successful PUT or PATCH returns `200 OK` with the resulting resource in the standard success envelope.

## Common request validation

- Request bodies use JSON and reject unknown properties.
- `id`, `ownerId`, `createdAt`, and `updatedAt` are server-controlled. A body containing any of them is rejected rather than silently ignored.
- Path IDs and non-null relation IDs must be syntactically valid UUIDs.
- The server performs the same-owner collection lookup before creating or updating a bookmark relation.
- Database constraints mirror required scalar and relation guarantees where PostgreSQL and Prisma support them.

Validation failures use `400 Bad Request` with the `VALIDATION_ERROR` code,
the `Request validation failed` message, and an array of non-sensitive details.
The shared success and error envelopes are defined in the Response contract
below.

## Owner changes and future administration

There is no admin role or cross-owner operation in the assignment. The current API therefore has no route, claim, or payload field that can override or transfer `ownerId`.

`TODO`: Consider an administrative ownership capability only if it becomes an explicit product requirement. It would require a separate authorization model and API contract; it must not be implemented as a normal `PATCH` field.

## Sharing

Collection sharing is deferred and is not part of the current API. There are no share records, invitations, public links, shared-resource routes, or exceptions to owner-scoped access. A collection and its bookmarks are accessible only to their authenticated owner.

`TODO` (future only): Before sharing is implemented later, define the recipient identity, permission levels, grant and revocation lifecycle, resource-discovery behavior, privacy-error policy, and verification plan in a separate API and authorization design.

## Persistence

All route data is persisted in PostgreSQL 18.4 through Prisma. PostgreSQL runs locally through Docker Compose. Application entities use UUID identifiers generated by Prisma and stored using PostgreSQL's native UUID type. TypeORM is not used.

Seed data must include at least two distinct users so ownership isolation can be tested.

## Response contract

Every successful JSON response contains:

```json
{
  "statusCode": 200,
  "message": "Bookmark retrieved",
  "data": {}
}
```

The `statusCode` in the body is derived from and must equal the actual HTTP response status. Success messages describe the completed operation but are not a machine-readable contract and must not control frontend behavior.

Success status and data rules:

- `GET` returns `200 OK`; `data` is the resource object or list array.
- `POST` returns `201 Created`; `data` is the created resource.
- `PUT` and `PATCH` return `200 OK`; `data` is the resulting resource.
- `DELETE` returns `200 OK`; `data` is null. It does not use `204 No Content` because the selected contract requires a response envelope.

Operation messages use `User retrieved` for `/me`; `Collection retrieved`, `Collections retrieved`, `Collection created`, `Collection updated`, or `Collection deleted` for collection operations; and the corresponding singular or plural bookmark message for bookmark operations. The nested collection-bookmarks route uses `Bookmarks retrieved`.

Every list response adds `meta` as a sibling of `data`, using the pagination contract above. Single-resource and delete responses do not include `meta`.

Every error response contains:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "url",
      "message": "Must be an absolute HTTP or HTTPS URL"
    }
  ]
}
```

Error mappings:

| HTTP status | `code` | `message` | `details` |
| --- | --- | --- | --- |
| `400 Bad Request` | `VALIDATION_ERROR` | `Request validation failed` | Field-level validation entries when available. |
| `401 Unauthorized` | `UNAUTHORIZED` | `Unauthorized` | Empty array. |
| `404 Not Found` | `NOT_FOUND` | `Resource not found` | Empty array. |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | `Internal server error` | Empty array. |

`details` is always an array. It may identify invalid field paths and constraints but must never echo rejected values, credentials, raw tokens, ownership facts, or internal exceptions. Authentication and unexpected-server-error responses remain generic. Missing and other-owner cases must produce identical JSON content for the same request shape.

## Required verification

Automated tests must prove authentication and owner isolation across every endpoint and method. At minimum, user A must be unable to list, filter, get, create under, update, patch, delete, or infer the existence of user B's resources. Tests must also reject attempts to submit or change `ownerId` and attempts to attach a bookmark to another user's collection.

For every direct, nested, mutation, deletion, collection-filter, and bookmark-relation path, tests must compare a nonexistent ID with another owner's existing ID and prove that both receive the identical generic `404 Not Found` status and body. An owned empty collection must instead return a successful empty bookmark list.

Response-contract tests must prove the actual HTTP status always matches the body `statusCode`, success and error envelopes have the documented fields, deletion returns `200 OK` with `data: null`, validation details do not echo submitted values, and generic errors expose neither credentials nor internal exceptions.

Filter tests must prove case-insensitive collection-name substring matching, bookmark filtering by an owned collection, uncategorized selection, rejection of malformed and mutually exclusive parameters, successful empty results, the uniform 404 for inaccessible collections, and owner isolation for every query.

Pagination tests must prove default and boundary behavior, rejection of invalid values, deterministic `createdAt DESC, id DESC` ordering, correct filtered totals and total pages, successful empty out-of-range pages, nested-route behavior, and exclusion of other owners' records from both `data` and `meta.total`.

Nested-route tests must prove malformed-ID validation, identical missing and other-owner 404 responses, successful owned empty and populated lists, pagination, owner-scoped counts, rejection of unsupported query parameters, behavior after collection deletion, and equivalence with the bookmark `collectionId` filter.

Collection-deletion tests must prove that deleting an owned collection removes it, preserves all of its bookmarks, sets their `collectionId` to null, leaves already-uncategorized and unrelated bookmarks unchanged, and cannot alter another owner's collections or bookmarks.

Because sharing is deferred, privacy tests must continue to prove strict owner-only access with no shared-access exception.

Update tests must prove that `PUT` requires the complete required writable representation and clears omitted nullable bookmark fields, while `PATCH` preserves omitted fields, applies explicit null only to nullable fields, and rejects an empty object. Both methods must reject unknown and server-controlled fields and preserve owner isolation.

User-lifecycle tests must prove that a valid first request creates exactly one local user, later requests reuse it, simultaneous first requests cannot create duplicates, and unvalidated identities cannot provision users. Seeded test users must remain separate from the real Auth0-backed account.

Profile-enrichment tests must prove that successful `/userinfo` responses persist available email and name values, missing claims remain null, and timeouts or error responses do not fail the authenticated request. They must also prove that existing users do not trigger repeated `/userinfo` calls.
