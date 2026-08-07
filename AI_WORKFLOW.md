# AI Workflow

AI agents were used to research, design, implement, review, debug, and test the
submission. The candidate remained the decision-maker: `AGENTS.md`, the
assignment PDF, and candidate corrections overrode agent assumptions. The raw
visible conversations are retained under `transcripts/`; they include mistakes
and recovery rather than presenting the implementation as a one-pass result.
Credentials, raw bearer tokens, hidden reasoning, and low-level tool transport
are excluded from those records.

## Direction and review loop

The working loop was:

1. Read the assignment and turn unresolved choices into explicit `TODO`s.
2. Discuss each material choice with the candidate and record accepted behavior
   in `DECISIONS.md` and API-facing behavior in `API_DESIGN.md`.
3. Implement a small slice against those documents.
4. Review the real code path, not only the diff, with special attention to the
   owner-only privacy invariant.
5. Reproduce reported failures and add a regression test before or with a fix.
6. Run targeted checks, then the complete tests, typechecks, builds, Prisma
   validation, and SQL integration test when PostgreSQL is available.
7. Update documentation only with behavior supported by runnable evidence or an
   explicit limitation.

Frontend and tester sub-agents were given separate file ownership during the UI
refresh. The primary agent integrated and reviewed their output. That review was
necessary: delegated output was treated as an untrusted draft, not accepted
because it came from another agent.

## Mistakes found in the raw conversations

| Evidence | What the AI got wrong | Detection and correction |
|---|---|---|
| `01-planning.md`, Turn 21 | A documentation patch used context from the wrong target file. | The patch applied no changes. The target was rechecked before applying the privacy-error decision to the correct document. |
| `01-planning.md`, Turn 29; `02-implementing.md`, Turn 2 | The first frontend Auth0 defaults used port `5173`, `/collections` as the logout destination, and raw history navigation, despite the required callback being `http://localhost:3000/callback` and logout URL being `http://localhost:3000`. | The candidate noticed the mismatch. The configuration, Vite port, router callback, README, and decision record were corrected and reverified. |
| `02-implementing.md`, Turns 3-6 | The agent misunderstood "new file implementing," appended implementation material to the planning transcript, then initially produced a summary instead of the requested raw conversation. | The candidate corrected both mistakes. The accidental planning entry was removed, `02-implementing.md` was created, and its content was replaced with role-by-role visible conversation. |
| `02-implementing.md`, Turn 7 | The initial callback/API flow had two omissions: backend Auth0 settings were absent from the backend environment, and the frontend had no session-recovery behavior after an API `401`. | Source tracing and a controlled repro showed an empty `AUTH0_CLIENT_ID` caused the backend rejection while valid controlled-JWKS tokens passed. A backend environment template and frontend one-shot logout-to-sign-in handler were added with regression coverage; token validation was not weakened. |
| `02-implementing.md`, Turns 10-11 | "Create sub agent in this project" was first interpreted as "start live agents." Three temporary agents were spawned with an available model that was not the requested project configuration. | The candidate clarified the intent. The temporary agents were interrupted before producing edits, official project-agent configuration was researched, and reusable `.agent/` guides plus `.codex/agents/` adapters were created. |
| `03-frontend-ui.md`, Review and corrections | Initial delegated UI code contained MUI typing problems, action controls nested inside an accordion button, incomplete collection selectors, stale options, a post-save expansion race, overly destructive error rendering, and encoding artifacts. | Primary-agent integration review, typechecking, accessibility inspection, and interaction tests exposed the issues. Each was corrected before the feature was reported complete. |
| `03-frontend-ui.md`, Review and corrections | Early Vitest setup used expression-bodied `beforeEach` callbacks that returned `mockReset()`. Vitest interpreted the returned mock as cleanup and invoked it without an API path. | The callbacks were changed to block bodies returning nothing. The permissive no-path workaround was removed so unexpected requests fail visibly. |
| `03-frontend-ui.md`, collection-creation follow-up | The first collection refresh implementation accepted out-of-order list responses. A slow pre-create request could overwrite the newer post-create result and hide the new collection. | The candidate reported the bug. A delayed-response regression test reproduced it, while a normal-order control test falsified the theory that no refresh was requested. Request generations now ignore stale success, error, and loading completions. |
| `04-requirements-testing.md` | The documented PostgreSQL test command set `RUN_DB_TESTS` but did not load `backend/.env`, so Prisma failed before assertions because `DATABASE_URL` was missing. | The same test passed with Node's `--env-file=.env`; README now uses that reproducible command. The failure and recovery remain in the transcript. |
| Previous `AI_WORKFLOW.md`; `04-requirements-testing.md` | The workflow document continued to say Docker and live SQL verification were unavailable after the environment later exposed a healthy PostgreSQL 18.4 service. | The SQL integration test was actually run and passed. This document now distinguishes the earlier limitation from the current verified state instead of retaining the stale claim. |
| `06-auth-session-persistence.md` | The frontend explicitly selected Auth0's in-memory token cache, so a page reload discarded cached authentication state and relied on cookie-based silent recovery. This behavior and its trade-off had not been decided or tested. | The candidate reported the refresh failure. Source tracing confirmed `cacheLocation="memory"`; the choice was documented before changing the provider to SDK-managed `localstorage`, and a Vitest regression check was added. Refresh tokens were not enabled without tenant confirmation, and live Auth0 reload remains an environment smoke test. |

Interrupted package installation, a read-only Vite cache path, an unavailable
in-app browser, Git's repository-ownership check, and the registry's lack of a
published React Router 8 package were environment/tool constraints. They are
recorded in the transcripts but are not mislabeled here as AI reasoning errors.
The recovery rule is still the same: do not convert an unavailable check into a
passing claim; use a safe deterministic substitute where possible and state
what remains unverified.

## Review controls added after mistakes

- Configuration values that are fixed by the assignment are now checked across
  frontend defaults, environment examples, README instructions, and Auth0 SDK
  parameters together.
- Async list tests deliberately reverse response order so a refresh cannot be
  considered correct only under ideal network timing.
- Test hooks must return nothing unless a cleanup function is intentional.
- Sub-agent tasks require explicit file ownership, and their changes must pass
  primary-agent code-path review, tests, typechecking, and build checks.
- Transcript requests require confirming both destination and format before
  editing; corrections are retained rather than erased from the raw history.
- Documentation commands are executed exactly as written before being claimed
  as reproducible.
- Privacy checks compare missing and other-owner responses and verify owner
  predicates on list, count, lookup, relation, update, patch, and delete paths.

## Verification and remaining limits

Current runnable evidence is:

- 81 backend Jest tests pass in the default suite; the SQL test is intentionally
  skipped there.
- The separate Prisma/PostgreSQL integration test passes against PostgreSQL
  18.4, including owner isolation, duplicate-name/URL allowance, and collection
  deletion preserving bookmarks through `SET NULL`.
- 36 frontend Vitest tests pass across nine files.
- Backend and frontend typechecks and production builds pass.
- Prisma schema validation passes.
- The frontend build retains a non-blocking large-chunk warning.

The HTTP contract suite uses controlled authentication and Prisma doubles for
fast branch coverage. Separate authentication tests exercise the real `jose`
signature/claim-validation path with generated RSA keys and a controlled JWKS
server, and the separate database test exercises real Prisma/PostgreSQL
persistence. A live browser login with the supplied Auth0 account and
inspection of a real audience-bound access token remain unverified because the
interactive browser/token was unavailable. Therefore the actual tenant token's
`azp` versus `client_id` profile remains a documented `TODO`; no live Auth0 E2E
claim is made.

## Reusable capabilities

`.agent/owner-scope-review.md` is the reusable checklist used during backend
resource implementation and the later requirements audit. It keeps token-derived
ownership, same-query owner scoping, relation validation, uniform 404 behavior,
and response redaction visible during review.

The project also contains frontend, backend, security-reviewer, and tester role
guides under `.agent/`, with Codex adapters under `.codex/agents/`. The frontend
and tester split was used for the UI refresh; primary review caught several of
the mistakes listed above. The transcript records that the requested Luna model
was configured for future project sessions but was not exposed by the live
runtime used when those definitions were created, so successful Luna execution
is not claimed.

## Transcript map

- `transcripts/01-planning.md`: assignment interpretation, Auth0 research,
  decisions, implementation recovery summary, and callback correction.
- `transcripts/02-implementing.md`: implementation, unauthorized-flow debug,
  transcript mistakes, and sub-agent misunderstanding/correction.
- `transcripts/03-frontend-ui.md`: delegated UI work, integration defects,
  regression fixes, and verification.
- `transcripts/04-requirements-testing.md`: expanded requirement tests and the
  failed-then-corrected PostgreSQL test command.
- `transcripts/05-ai-workflow-review.md`: candidate-requested audit of AI
  mistakes across the raw transcripts and the resulting workflow controls.
- `transcripts/06-auth-session-persistence.md`: candidate-reported reload
  failure, cache decision, implementation, and verification boundary.
