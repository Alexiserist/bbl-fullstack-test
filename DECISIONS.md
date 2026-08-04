# Decisions

## ADR-001: Use an access token as the API Bearer credential

- Status: Accepted
- Date: 2026-08-04

### Context

The assignment requires a decision between the tokens returned by the Auth0 Authorization Code with PKCE flow. An ID token communicates authentication information to the client application; its audience is the client. An access token requested for the custom API is intended to authorize calls to that API and can carry the API audience.

The live tenant discovery document advertises Authorization Code flow, PKCE with `S256`, and a JWKS endpoint. The assignment provides the custom API audience `https://bbl-candidate-test-api`.

### Decision

The backend will accept only an Auth0 access token requested for audience `https://bbl-candidate-test-api` in the HTTP `Authorization: Bearer <token>` header. It will not accept an ID token as API authorization.

Before authorizing a request, the backend must validate the token against the documented issuer, intended API audience, lifetime, and the signature key selected from the tenant JWKS. The precise algorithm and claim-validation rules remain `TODO` until an access token issued by the live tenant has been inspected.

### Rationale

Accepting an audience-bound access token prevents the API from treating a token intended for the frontend client as API authorization. This reduces token-substitution and confused-deputy risk and follows Auth0's documented token purposes.

### Consequences and trade-offs

- The frontend must include the API audience when starting authorization; otherwise Auth0 may issue a token intended only for `/userinfo` rather than this backend.
- Profile claims such as email are not guaranteed to be in the API access token. Local-user mapping must rely on verified identity claims, with the exact mapping still `TODO`.
- Access tokens are bearer credentials: disclosure permits use until the token expires, so they must not be logged or committed.
- Current JWKS keys are marked `RS256`, but the backend must not hardcode a key identifier because signing keys can rotate.

### Evidence

- Tenant discovery: <https://dev-yg.us.auth0.com/.well-known/openid-configuration>
- Tenant JWKS: <https://dev-yg.us.auth0.com/.well-known/jwks.json>
- Auth0 token guidance: <https://auth0.com/docs/secure/tokens>
- Auth0 access-token validation guidance: <https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens>

## ADR-002: Scope all API operations to the authenticated owner

- Status: Accepted
- Date: 2026-08-04

### Context

The assignment's central privacy invariant says one person must not see, edit, or learn of another person's data. A proposed future admin use case considered allowing `PATCH` to override `ownerId`, but the assignment defines no admin role, permission, ownership transfer, or audit behavior.

### Decision

Every backend route requires authentication, and every collection and bookmark operation is scoped to the authenticated owner. The server derives ownership from the validated Auth0 identity and local-user mapping.

`ownerId` is server-controlled, excluded from writable payloads, and immutable through `POST`, `PUT`, and `PATCH`. Requests that contain `ownerId` are rejected. The current API has no admin bypass or ownership-transfer operation.

### Rationale

Allowing an ordinary update payload to select an owner would create a direct cross-user data-access path and violate the assignment's privacy invariant. Keeping ownership outside writable resource fields makes the secure path the default for every route.

### Consequences and trade-offs

- Current users cannot transfer resources between owners.
- No administrator can access or reassign another person's data through this API.
- A future administrative capability would require an explicit product requirement, separate authorization policy, API contract, and verification. It cannot be added by enabling `ownerId` in the existing patch schema.
- The exact Auth0-identity-to-local-user mapping remains `TODO`.

Other unresolved requirements remain marked `TODO` in `AGENTS.md`.
