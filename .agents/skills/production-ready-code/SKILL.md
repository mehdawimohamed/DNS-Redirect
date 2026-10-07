---
name: production-ready-code
description: >-
  Use this whenever writing, extending, reviewing, or refactoring application code in any stack - endpoints, services, repositories, queries, jobs, UI data layers - including Python/FastAPI and AI media-generation systems (model inference, ComfyUI, Modal/serverless-GPU integration). Enforces senior-engineer discipline: reuse existing functions, endpoints, DTOs, schema, components, and inference-provider adapters before creating new ones, but never force a shared abstraction across a security, tenant, or money boundary; batch/join queries instead of N+1 loops; treat secrets, authorization, and startup config as fail-closed with zero hardcoded fallbacks; design for statelessness, pagination, and idempotent retries (including cost-aware paid-GPU calls); never report code as done or verified without runnable proof. Trigger even when the user only says "clean this up", "make it production-ready", "review this PR", "this needs to scale", "is this secure", or asks for a new feature without mentioning code quality.
---

# Production-ready code

You are not just making the current task pass. Write as if you will be the
one paged when this runs at ten times today's traffic, and as if someone
will read your auth code tomorrow specifically looking for a way in. Every
rule below exists because of a real, specific failure mode. The reasoning is
included, not just the rule, so you can extend it to cases this file doesn't
name - a skill that only pattern-matches to its own examples is not actually
enforcing the underlying discipline.

This skill is stack-agnostic on purpose, because it travels across projects.
Each reference file below has a short "in practice" example or two, but
treat those as illustrations, not the boundary of what the rule covers.

## Before you touch the code

- **Map the codebase's real boundaries once, at the start of the session** -
  which modules are public vs authenticated vs admin-only, which paths touch
  money or write to another tenant's data, where the schema and shared UI
  components live. Don't assume this project is shaped like the last one.
- **Read the actual current implementation before writing anything new** -
  controllers, services, schema, existing components. An assumption about
  what already exists is exactly how duplicate endpoints, drifted DTOs, and
  parallel "helper" functions get created.

## The five things a senior engineer always checks

### 1. Reuse - without reaching for the wrong abstraction

Before writing a new function, endpoint, DTO, model, or UI component,
search for one that already does this or something close to it. Extend or
call it rather than writing a parallel version. This is real: parallel
endpoints for the same task drift apart, and duplicated DTOs desync from
the schema the moment one of them changes.

But reuse is not the same as "never duplicate." Forcing two things that
only *look* alike today into one shared function is how you get a function
with five boolean parameters and a comment that says "don't touch this" -
and a shared abstraction that crosses a security, tenant, or money
boundary is a vulnerability waiting for the next person who touches it.
Wait for a third, genuinely identical occurrence before you extract a
shared abstraction, and never share one across a trust boundary just to
save a few lines.

→ `references/reuse-and-boundaries.md` for the discovery checklist, the
rule of three, and worked good/bad examples.

### 2. Data access that survives scale

Fetch what a task needs in one round trip: joins or relational queries
instead of chained lookups, `IN` batching instead of a loop of single-row
queries, and only the columns the task actually needs. Multi-step writes
that must succeed or fail together belong in one transaction, not a
read-then-write sequence that can be interrupted halfway. Anything a
malicious or merely enthusiastic user can grow without bound - a list, a
search, a feed - is paginated, never fully loaded. A query that looks fine
against ten seeded rows can hide a missing index that only shows up at
real volume, so prove the index is used rather than assuming it.

→ `references/data-and-queries.md` for N+1 patterns, indexing, pagination,
and idempotency for retryable writes.

### 3. Security is fail-closed by default

A missing token, a missing role, or a missing config value should always
result in "deny" or "refuse to start," never in code quietly proceeding as
if everything were fine. Authorization is enforced globally and public
routes are the explicit exception, not the other way around - a codebase
where each controller must remember to add its own guard will eventually
have one that forgot. Never hardcode a secret, API key, or token as a
fallback value, in application code, scripts, or tests - if a required
value is missing, fail loudly at startup, not silently at request time.

→ `references/security-by-default.md` for the fail-open failure patterns
this catches, input validation, and secret handling.

### 4. Built to scale out, not just to work once

A process should be able to be killed and restarted, or have five more
copies started next to it, without anything breaking. That means no state
that only lives in one process's memory or local disk if it needs to
survive a restart or be visible to another instance - it belongs in a
database, cache, or object store instead. Configuration comes from the
environment, not from a branch in the code. Anything retried - a payment,
a webhook, a queued job - is either naturally idempotent or protected by
an idempotency key or a unique constraint, because retries *will* happen.

→ `references/scale-and-operability.md` for statelessness, structured
logging, startup/shutdown behavior, and shipping a real rollback path.

### 5. Prove it, don't claim it

"The code looks right" and "I ran it and it passed" are different claims -
say which one you mean. Every new or changed piece of logic ships with a
test that would have failed on the old code and passes on the new code;
that's the actual evidence something was fixed, not a description of the
fix. No empty catch blocks or silently swallowed errors. Anything you
could not actually run gets reported as not checked, with the reason, not
quietly implied to be fine. Before reporting a count - tests passing,
coverage, findings - add it up yourself; numbers that don't reconcile
undermine every other claim in the same report.

→ `references/testing-and-verification.md` for what counts as proof and
common ways agents accidentally overstate it.

## Domain-specific extensions

The five checks above are universal, but two domains common to this
project change what they mean in practice enough to warrant their own
reference files. Read the relevant one alongside the check it extends,
not instead of it.

- **Python / FastAPI backends** - dependency injection as the actual home
  of reuse and deny-by-default authorization, async session and event-loop
  discipline, and what statelessness/idempotency mean under multiple
  Uvicorn workers → `references/fastapi-production-patterns.md`
- **AI model inference and media generation** (image/video generation via
  diffusers, a hosted model, or similar) - one provider adapter per model
  instead of scattered call sites, why a duplicate generation call is a
  cost bug and not just a correctness bug, cold-start-aware timeouts, and
  spend/concurrency caps as the scale-and-operability concern that matters
  most here → `references/ai-media-generation-services.md`
- **ComfyUI workflows and GPU-platform (Modal or similar) integration** -
  treating workflow JSON as a versioned artifact, constraining which
  fields user input is allowed to inject into a workflow, idempotency
  against a queued/cached execution engine, and what belongs in the
  deployed image vs. a dev-only install → `references/comfyui-and-gpu-platform-integration.md`

## Before you say it's done

Run this list against your own change before reporting it complete:

1. Did I search for an existing function, endpoint, DTO, or component
   before writing a new one - and can I point to what I found?
2. If I reused or extended something, does it cross a security, tenant,
   money, or domain boundary? If yes, did I keep it separate instead?
3. Does every list or query that can grow use pagination and batching,
   with an index I've actually confirmed is used?
4. Is every multi-step write inside a transaction, and every retryable
   write idempotent?
5. Is authorization deny-by-default, with public routes as the explicit
   exception?
6. Is there any hardcoded secret or a fallback literal for one, anywhere,
   including tests and scripts? (Grep for it - don't just recall writing
   it correctly.)
7. Does the app fail fast at startup on bad config, instead of degrading
   silently at request time?
8. Is any state that must survive a restart or scale-out stored in a
   backing service, not in process memory or on local disk?
9. Do logs and error messages redact secrets, tokens, and personal data?
10. Does every changed behavior have a test that would have failed before
    the change and passes after it?
11. Have I reported only what I actually ran, with the output to show it,
    and marked everything else not checked?
12. Do my own reported numbers actually add up?

## How to work

Prefer targeted search over loading whole directories, and view specific
line ranges rather than entire large files, so you spend your attention on
the code that matters for the task. Make surgical edits rather than
rewriting files wholesale when only part of a file needs to change. This
is about using your own context well, not a shortcut around anything
above.

## Adapting this to a new codebase

Nothing in this file is a form to fill out mechanically. On a new project,
spend the first pass understanding where its actual boundaries are - what
counts as a security boundary, what "money-affecting" means here, what the
existing reuse candidates even are - and apply the reasoning above to that
shape, rather than importing assumptions from wherever this skill was last
used.
