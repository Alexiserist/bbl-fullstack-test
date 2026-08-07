# AI workflow mistake review - Raw Conversation

- Date: 2026-08-07
- Scope: Review prior raw transcripts for AI mistakes and incorporate the
  mistakes, corrections, and resulting controls into `AI_WORKFLOW.md`.
- Recording note: This file contains visible user/assistant conversation and a
  concise action record. Hidden reasoning, tool transport, credentials, and raw
  tokens are excluded.

## Turn 1 - Audit mistakes and update the workflow

### User

> read about the ai that make mistake raw conversation and put it in ai workflow

### Assistant (work update)

I’ll review the raw session transcripts for concrete mistakes and recoveries,
then update `AI_WORKFLOW.md` with an honest account of what went wrong, how it
was detected, and what verification prevented those mistakes from becoming
unsupported claims. I’ll preserve the raw transcripts rather than rewriting
history.

### Assistant (work update)

The transcripts contain several real, useful failures—not just successful
summaries. I’ve already found stale claims in `AI_WORKFLOW.md` itself (it still
says Docker/SQL verification was unavailable, although the later session ran
PostgreSQL successfully). I’m reading the longer transcripts in chunks now so
the final write-up distinguishes AI mistakes from ordinary environment
limitations and user-driven changes.

### Assistant (work update)

The evidence separates into three categories: AI-generated defects (wrong
Auth0 URLs, stale-response race, accessibility/test-harness issues), workflow
mistakes (writing to the wrong transcript and spawning live agents after
misunderstanding the request), and environment limitations
(browser/registry/Git access). I’ll document the first two as mistakes and keep
the third category explicitly separate so the workflow does not blame the AI
for unavailable infrastructure—or use infrastructure limits to excuse
incorrect claims.

### Action record

`AI_WORKFLOW.md` was rewritten to include:

- a traceable table of ten mistakes and their corrections;
- review controls introduced after those mistakes;
- current verified test, build, Prisma, and PostgreSQL evidence;
- a separation between AI mistakes and environment/tool limitations;
- the remaining live Auth0 verification boundary; and
- the reusable owner-scope and project-agent capabilities actually used.

The original transcripts were not rewritten or sanitized after the fact; their
mistakes and candidate corrections remain visible.
