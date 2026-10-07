# Tracing a generation request end to end (jobs, streams, webhooks, credits)

A "generate" request crosses many hops, and the visible failure ("the
progress bar is stuck", "I was charged but got nothing", "it generated
twice") is usually several hops away from its cause. Trace by hop, and at
each hop ask the same question: **what evidence shows the request arrived
here, and what evidence shows it left?** The first hop where "arrived" is
true and "left" is false is where to look.

## The hops, and the evidence at each

| Hop | Arrived / left evidence |
|---|---|
| Browser -> API | request in network tab / API access log; status code |
| API validation & auth | log line with user id; a `4xx` response body |
| Credit reservation | ledger or reservation row for the job id |
| Job row created | `jobs` row, `status`, timestamps |
| Worker claims job | status moved off `queued`; worker log with job id |
| Call to GPU function | `modal_call_id` (or equivalent) stored on the row |
| GPU function runs | platform logs for that call id |
| Output written to storage | object exists under the expected key, right size/type |
| Moderation / post-processing | status transition and recorded result |
| Credit charge or release | ledger row for the job id |
| Event to client | SSE stream / notification actually emitted |

If any of these has no log line carrying the **job id**, the first fix is
observability: add the id to every hop before theorising further.

## Stuck in `queued` or `running`

- `queued` forever: nothing is claiming jobs. Is the worker process running
  (and the same code version)? Is it polling the same database? Is a
  `WHERE` clause (or `FOR UPDATE SKIP LOCKED`) excluding rows that are held
  by an open transaction? Check for a crashed worker holding a claim, and
  for a timezone/clock bug in a "not before" condition.
- `running` forever: the worker died after claiming, or lost the remote
  call, or never received a completion signal. Look for a stored remote
  call id: if present, ask the platform for its status directly. Add a
  sweeper that fails or requeues jobs stuck longer than a timeout - and
  find out *why* they got stuck, since a sweeper hides the cause.
- Progress stops but the job completes: the event path is broken (see the
  stream section), not the job.

## Progress stream problems (SSE)

Same-process assumption is the classic: the code that updates progress
publishes to an in-memory subscriber list, but the request holding the
client's stream is served by a different worker process, or the API
restarted. Reproduce with two workers. Also check that a reconnecting
client gets the **current state first** (a snapshot), otherwise a reconnect
after completion shows an endless spinner. Proxy buffering problems are
covered in `fastapi-and-python.md`.

## "Charged but no result" / "result but not charged" / "charged twice"

These are ledger-consistency bugs. Establish, from the database:

1. How many ledger rows exist for the job id, and their sign, amount and
   `balance_after`?
2. Does `sum(ledger.amount)` for the user equal `users.credit_balance`?
   If not, something updated the balance without writing a ledger row
   (find the code path - that is the bug).
3. What was the job's final status, and did the path that set it also run
   the charge/release in the **same transaction**? A status update
   committed before a charge that then raised leaves a completed job that
   was never charged; the reverse charges for a job that then failed.
4. Was the completion handler invoked twice (webhook redelivery, poll and
   webhook both firing, a retry)? Without a uniqueness constraint on the
   charge for a job, a second invocation charges again. The fix is the
   constraint (idempotency in the database), not "be careful".

Prove the fix with a test that fires the completion handler twice and one
that runs concurrent reservations against a small balance.

## Webhook signature "mismatch"

Signature failures are nearly always about **which bytes were signed**:

- Verifying against a re-serialised body instead of the exact raw bytes
  received (whitespace, key order, number formatting such as `1.0` vs `1`
  or scientific notation all change the digest). Read the raw body before
  any JSON parsing.
- Providers that sign a canonical form - for example NOWPayments signs the
  payload **with keys sorted (recursively)** using HMAC-SHA512 and your IPN
  secret, sent in the `x-nowpayments-sig` header. Reproduce their exact
  canonicalisation, including nested objects.
- Wrong secret (test vs live, or an API key used where the IPN secret is
  needed), trailing whitespace/newline in the env var, or a proxy that
  modifies the body.
- Use a constant-time comparison; and log *that* verification failed and
  which delivery id it was, never the secret or the full signature.

## Payment states that look like success but are not

Credit only on the provider's final success status. For NOWPayments that
is `finished`; `confirming`, `confirmed`, `sending` and especially
`partially_paid` are intermediate or short-paid, and a partially paid
payment can later move to `finished` under the same payment id. A handler
that credits on any "non-failed" status will over-credit or double-credit.
Also compare the amount actually received against what the invoice
expected before granting credits, and make the handler a no-op for a
payment already in a terminal state. Re-verify status semantics against the
provider's current documentation, since they change.

## Stale or missing data after the fact

If a bug report arrives days later ("my video vanished"), the answer is in
object-storage lifecycle rules, soft-delete flags, moderation status
(hidden, not deleted), or signed URLs that expired - check those before
looking for data loss.
