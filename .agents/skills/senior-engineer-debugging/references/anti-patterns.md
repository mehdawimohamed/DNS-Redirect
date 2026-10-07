# Debugging anti-patterns to catch in your own work

These are the specific, recognizable shapes that "AI slop" debugging takes.
Each one produces a change that looks reasonable and often makes the
symptom disappear, without ever establishing why the failure happened.

## Shotgun debugging

Changing several plausible things in the same pass, then reporting success
if the failure stops.

**Looks like**: adjusting a timeout, a retry count, and an error boundary
in the same commit because any of them "might be it."

**Why it fails**: if the failure stops, you don't know which change did
it - which means you can't explain the bug, can't be confident it won't
recur under slightly different conditions, and have shipped two unrelated,
untested changes riding along with the one that mattered.

**Instead**: one hypothesis, one change, one test of that specific change.
If it doesn't confirm the hypothesis, revert it before trying the next one.

## Symptom patching

Making the crash or error stop without touching why the invalid state
existed.

**Looks like**:
```
// Bad - hides the problem
try {
  const total = order.items.reduce((s, i) => s + i.price, 0);
} catch {
  return 0;
}
```
```
// Bad - same shape, different syntax
const total = order.items?.reduce((s, i) => s + i.price, 0) ?? 0;
```
Both versions stop the crash. Neither answers why `order.items` was
`undefined` in the first place - a bug in whatever loaded `order`, still
present, now invisible.

**Instead**: trace back to where `order` is loaded or constructed, find why
`items` can be missing there, and either fix that path or make the
"missing items" case an explicit, intentional branch with a comment
explaining when it's expected - not a silent catch-all.

## Assumption cascades

Treating an untested guess as an established fact and building the next
several steps on top of it.

**Looks like**: "This is probably a caching issue" → proceeds to rewrite
the caching layer → the bug was actually a stale database connection, and
now there's an unrelated rewrite to also account for.

**Instead**: state the guess as a hypothesis, find the cheapest way to
confirm or refute it (a log line, a cache-disabled test run), and only
proceed once it's confirmed.

## Declaring victory without re-running the failure

Reporting a fix as complete because the change looks correct on inspection,
not because the original failing case was actually run again.

**Looks like**: "This should resolve the issue" as a final answer, with no
mention of having re-triggered the original reproduction steps.

**Why it fails**: code that looks right and code that is right are
different claims, and only one of them is backed by evidence. A fix that
"should work" and hasn't been re-verified against the exact original
failure is still a hypothesis, not a result.

**Instead**: re-run the specific reproduction that started the
investigation (the same input, the same request, the same test) and
report the actual outcome - not a prediction of it.

## Inventing a root cause for a bug you never reproduced

Producing a confident, specific-sounding explanation for a failure that was
never actually triggered or observed directly - often from the error
message's vocabulary alone.

**Why it fails**: a narrative that's consistent with an error message is
not the same as a narrative confirmed by evidence. Plausible and correct
are different properties, and an explanation optimized to sound complete
is often optimized for the wrong thing.

**Instead**: if you can't reproduce the failure, say exactly that, and say
what information or access would let you reproduce it - don't fill the gap
with a guess dressed as a finding.

## A quick self-check while you work

If any of these are true right now, stop and go back a step before
continuing:

- You've made more than one change and aren't sure which one mattered.
- You're about to report a fix without having re-run the original failing
  case.
- Your explanation of the cause uses words like "probably" or "likely" in
  the sentence you're about to present as the root cause.
- The fix is a catch block, a fallback value, or an optional-chain added
  at the point of the crash, and you haven't looked upstream of it yet.
