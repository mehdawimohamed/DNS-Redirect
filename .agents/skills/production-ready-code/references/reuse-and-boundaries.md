# Reuse and boundaries

Two failure modes sit on either side of this: writing a parallel version of
something that already exists, and forcing two things that only look alike
today into one shared abstraction that shouldn't be shared. Both are common,
and both get worse the longer they go unnoticed.

## Discover before you create

Before writing a new function, endpoint, DTO, model, migration, or UI
component, spend a few targeted searches confirming one doesn't already
exist:

- **API surface**: existing controllers/route handlers and their DTOs or
  schemas. Extend a DTO with an optional field, or add a discriminated
  variant, before adding a near-duplicate endpoint for a slightly different
  case.
- **Business logic**: existing service/domain methods. A second
  `calculateSomething` a few files away from the first is a sign the first
  one wasn't found, not that the domain needed two.
- **Data layer**: the schema and its defined relations. Use them instead of
  parallel storage for the same concept (a second table or field that
  duplicates what another already tracks).
- **UI**: shared components and design tokens. Composing from existing
  primitives (spacing, radius, color, typography tokens; existing button,
  card, input components) instead of hand-rolled styles keeps the UI
  consistent and keeps a future design change to one place.

This is worth the search time because the failure mode is expensive: two
endpoints that were supposed to do the same thing drift the moment one of
them is patched and the other is forgotten, and nobody notices until a bug
report shows the two disagreeing.

## The rule of three, and why hasty abstraction is worse than duplication

Seeing the same shape twice is not enough information to know if it's a
real pattern or a coincidence. Wait for a third genuinely-identical
occurrence before extracting a shared function, class, or component - by
then the real shape has usually revealed itself, and the abstraction you
build actually fits all three callers instead of the two you happened to
notice.

If you consolidate too early, the usual outcome is well documented: a new
requirement comes in that's *almost* what the shared function does, and
rather than write a new function, the existing one grows a parameter, then
a conditional, then another parameter for another caller's edge case. A
few iterations later it has five boolean flags and a comment warning people
not to touch it. Duplicated code is easy to reason about - one change, one
place. A bad shared function is not - one change now risks every caller
that depends on it, including the ones you didn't know existed.

If you find yourself maintaining an abstraction like that, the fix is
usually to go backwards: inline it into each caller, use the parameters
that caller was passing to strip out the branches it doesn't need, and see
what's actually left. Often each caller turns out to want something
slightly different, and the "duplication" you're recreating was never
actually the same logic to begin with.

**Bad** - two callers forced into one function on day one:
```
function updateBooking(id, changes, { isAdminForce = false } = {}) {
  // isAdminForce skips the normal state-transition checks below...
}
```
**Good** - two functions, because "admin force-update" and "guest edits
their own booking" are different operations with different rules, even
though most of the code looks the same today:
```
function updateBooking(id, changes) { /* normal transition rules */ }
function adminForceUpdateBooking(id, changes, adminId) {
  /* logged, authorized separately, different rules */
}
```

## Never share an abstraction across a boundary

Regardless of how similar the code looks, keep these separate rather than
consolidating them into one shared path:

- **A security/trust boundary** - public vs authenticated vs admin-only.
  The part of "almost identical" code that differs is usually exactly the
  authorization check, which is the one part that must never become
  optional or parameterized away.
- **A tenant boundary** - one customer's or organization's data path vs
  another's. A shared function here is one bug away from leaking data
  across tenants.
- **A money-affecting boundary** - anything that changes a balance, charges
  a card, or records a ledger entry vs everything else. Keep these
  deliberately separate and easy to audit in isolation, even at the cost
  of a little duplication.
- **A domain/bounded-context boundary** - two teams' or two features'
  concepts that happen to look similar today (for example, two different
  "status" enums that both happen to have "pending" and "complete"). They
  will diverge as each domain evolves; a shared abstraction here just
  delays and compounds the eventual untangling.

A few lines of duplicated, easy-to-read code across a boundary like this is
cheaper than one shared function with a flag that decides whether to run
the authorization check.

## Database query consolidation is a different kind of reuse

The rules above are about *logic* reuse. Consolidating *database round
trips* is almost always safe and worth doing, because it isn't creating a
shared abstraction across a boundary - it's just fetching what one task
already needs in one trip instead of several. See
`data-and-queries.md` for the patterns.
