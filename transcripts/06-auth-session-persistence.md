# Auth session persistence - Raw Conversation

- Date: 2026-08-08
- Scope: Investigate and correct authentication state lost on page reload.
- Recording note: This file contains visible user prompts and a concise action
  record. Hidden reasoning, tool transport, credentials, and raw tokens are
  excluded.

## Turn 1 - Report the reload problem

### User

> why not save session in local storage or session storage. right now when
> refresh it not persist token

### Assistant (diagnosis)

Source tracing found that `Auth0Provider` explicitly used
`cacheLocation="memory"`. The installed Auth0 SDK documents `memory` and
`localstorage` as its built-in cache locations; session storage would require a
custom cache. The assistant recommended SDK-managed local storage, documented
the increased XSS exposure compared with memory storage, and advised against
manually storing raw tokens or enabling refresh tokens without tenant
confirmation.

## Turn 2 - Implement the decision

### User

> yes implement this

### Action record

- Recorded the cache decision and security trade-off in `DECISIONS.md` before
  changing behavior.
- Changed the Auth0 provider from memory storage to an exported SDK-managed
  `localstorage` cache setting.
- Kept refresh tokens disabled pending confirmation that the supplied Auth0 SPA
  client permits refresh-token rotation.
- Added a deterministic Vitest check for the cache selection and clarified that
  a real Auth0 page-reload flow remains an environment smoke test.
- Updated README authentication guidance and ran frontend verification.
