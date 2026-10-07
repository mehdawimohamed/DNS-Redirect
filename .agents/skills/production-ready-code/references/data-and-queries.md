# Data access at scale

Code that is correct against ten seeded rows can still fall over at real
volume. This file is about the specific habits that make the difference.

## Eliminate N+1 round trips

**Bad** - one query per related row:
```
const booking = await findBooking(id);
const listing = await findListing(booking.listingId);
const guest = await findUser(booking.guestId);
```
**Good** - one query with the relations attached:
```
const booking = await db.query.bookings.findFirst({
  where: eq(bookings.id, id),
  with: { listing: true, guest: true },
});
```
The same idea applies to a loop over a list: fetching each item's related
row inside the loop turns one page load into N+1 queries. Fetch the whole
batch's related rows in one query keyed by the batch's IDs instead.

## Batch instead of looping single-row operations

**Bad**:
```
for (const id of ids) {
  await db.update(t).set({ processed: true }).where(eq(t.id, id));
}
```
**Good**:
```
await db.update(t).set({ processed: true }).where(inArray(t.id, ids));
```
A loop of single-row round trips is the same N+1 shape whether it's a read
or a write, and it gets slower in direct proportion to how successful the
product is - which is exactly when you'd most like it not to.

## Select only what the task needs

Fetching every column of a wide row when the task needs three of them costs
memory, wire payload, and serialization time on every request, and it gets
worse as the table grows more columns over time (a common way this creeps
in: someone adds a large text or JSON column later, and every existing
`select *` now pays for it).

## Multi-step writes belong in one transaction

If a task has to update two or more rows together - decrement a balance and
insert a ledger entry, confirm a booking and release a hold - wrap it in a
database transaction, and prefer the database's own atomic tools (a single
statement with a `RETURNING` clause, a CTE, an upsert) over a read-modify-
write sequence in application code. A read-then-write gives a concurrent
request a window to interleave and produce a result nobody intended.

## Correctness under concurrency is a database-level guarantee, not an
## application-level promise

If two requests must never both succeed for the same resource - two
bookings for the same dates, two orders consuming the last unit of stock -
enforce it with a database constraint (a unique index, an exclusion
constraint, a `SELECT ... FOR UPDATE`), not with an application-level check
followed by a separate write. A check-then-insert pattern has a race
condition built into its shape: two requests can both pass the check before
either one writes. Prove the constraint actually rejects the second writer
with a real concurrent test, not just a read of the migration file.

## Idempotency for anything that can be retried

Networks fail, clients retry, and webhooks get redelivered. Any write with
a real-world side effect - charging a card, sending a notification,
creating a booking - needs either a natural idempotency key (a unique
constraint on the operation's identity) or an explicit idempotency key
supplied by the caller and checked before the write. Without this, a retry
that was meant to be safe silently duplicates the side effect.

## Pagination and indexing

- Anything that can grow without bound - a list, a search result, a feed -
  is paginated. Prefer cursor-based pagination (a stable sort key plus a
  tiebreaker, usually the primary key) over offset-based pagination once a
  table is large or its sort order can tie; offset pagination re-scans
  everything before the offset on every page and can skip or repeat rows
  when new data is inserted between page loads.
- Every column a query filters or sorts on at scale needs an index that
  covers it. Don't assume the index is being used - confirm it with the
  database's own query plan (for example `EXPLAIN ANALYZE`). A plan run
  against a handful of seeded rows will often show a sequential scan
  regardless of the index, because the planner correctly judges the table
  too small to bother - so validate against a realistic row count, not the
  smallest dataset that happens to exist locally.
