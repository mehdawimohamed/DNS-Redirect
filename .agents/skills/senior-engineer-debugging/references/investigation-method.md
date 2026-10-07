# The investigation method, in full

The loop in the main skill file compresses decades of debugging practice
into seven steps. This file is the reasoning behind it, so you can apply it
to a failure shape it doesn't explicitly name.

## Why "junior vs. senior" is the right frame

Facing an error, a junior instinct is to ask "how do I make this message go
away." A senior instinct is to ask "why did the system reach a state where
this was even possible." The first question is answerable by any change
that stops the crash, including ones that make things worse in ways that
won't surface until later. The second question is only answerable by
tracing the failure back to where the bad state or bad assumption actually
originated - and it's the only one of the two that produces a fix instead
of a delay.

## The scientific debugging loop

This is the same shape of process taught in classic software-engineering
debugging material (see "Further reading" below): a bug report leads to
reproduction, reproduction leads to a hypothesis, the hypothesis is tested
by an experiment designed to confirm or refute it specifically, and only a
confirmed hypothesis becomes a fix. If an experiment doesn't confirm the
hypothesis, that's informative - it eliminates a candidate cause - and the
next step is a new hypothesis, not a second fix stacked on the first.

A hypothesis worth testing is falsifiable and specific:

**Too vague to test directly**: "Something's wrong with the auth flow."

**Testable**: "The 401 happens because the refresh token request fires
before the access token is stored, so the retry reads a stale value."

The second version tells you exactly what evidence would confirm or refute
it (log the token value at both points, in that order) and exactly what a
fix would need to change (the ordering, or the read).

## Rank hypotheses by how cheaply you can rule them out

When you have more than one plausible cause, resist testing them in order
of "most likely" - test them in order of "fastest to disprove." A
five-second log line that rules out one candidate is worth more than a
confident guess you can't quickly check. This also protects you from
sunk-cost debugging: if a hypothesis was cheap to test and failed, moving
to the next one costs little; if you'd spent an hour building out a fix for
it first, you'd be tempted to keep going past the point the evidence
stopped supporting you.

## Nine habits from classic debugging practice

These come from David Agans' *Debugging: The 9 Indispensable Rules*, and
they hold up well outside the embedded-systems context the book was
written for:

1. **Understand the system.** Know what the code is actually supposed to
   do, not just what you assume it does, before deciding something is
   broken.
2. **Make it fail on demand.** An intermittent bug is not ready to debug
   until you've found the condition that makes it reproducible.
3. **Quit thinking and look.** At some point, further reasoning about what
   might be happening is a worse use of time than adding one log line and
   looking at the actual value.
4. **Divide and conquer.** Narrow the failure's location with a binary
   search over the space it could be in, rather than a linear scan (see
   bisection below).
5. **Change one thing at a time.** If you change two things and the
   failure resolves, you have not learned which one mattered - and you
   may have shipped an unrelated, untested change along with the fix.
6. **Keep an audit trail.** Write down what you tried and what you
   observed as you go. A few minutes into an investigation, memory of the
   third thing you ruled out is already unreliable.
7. **Check the plug.** Verify the boring, obvious things before the
   interesting ones - wrong branch, stale build, wrong environment
   variable, a service that isn't actually running.
8. **Get a fresh view.** Explaining the problem out loud, or to someone
   else, routinely surfaces the assumption you didn't know you were
   making. If no one's available, write the explanation out in full
   sentences instead of skipping to the fix.
9. **If you didn't fix it, it isn't fixed.** A coincidental change in
   symptoms is not confirmation. The only proof is the original
   reproduction, run again, passing.

## Bisection: narrowing a large search space fast

When you don't know where in a large amount of code, history, or data a
problem lives, cut the search space in half and check which half still
reproduces the failure, then repeat. In practice this shows up as:

- **Code history**: `git bisect` between a known-good and known-bad commit
  to find the exact change that introduced a regression, rather than
  reading every commit in the range.
- **A large function or pipeline**: comment out or short-circuit the
  second half and see if the failure still happens with only the first
  half running, then narrow further.
- **A large input**: if a huge payload or dataset triggers a failure, cut
  it in half and test each half separately to find the specific record or
  shape that's responsible, rather than eyeballing the whole thing.

Bisection turns "the bug is somewhere in these 4,000 lines / 600 commits /
50,000 rows" into a handful of targeted checks instead of a linear read.

## Keeping an audit trail during a long investigation

For anything that takes more than a couple of probes to resolve, keep a
short running note of hypothesis tried → how it was tested → result. This
does two things: it stops you from silently re-testing something you
already ruled out, and a negative result stays useful precisely because
it's recorded, not just a discarded thought. When you report the fix,
this trail is also what lets you state the root cause with actual
confidence instead of a plausible-sounding summary written after the
fact.

## Further reading

- David J. Agans, *Debugging: The 9 Indispensable Rules for Finding Even
  the Most Elusive Software and Hardware Problems* (2002) - the source of
  the nine habits above, with worked war stories for each one.
- The classic "verify → find → fix" debugging process taught in
  software-engineering courses, e.g. Harvey Mudd's CS121 debugging notes
  (`cs.hmc.edu/~markk`), lays out the same observe → reproduce →
  hypothesize → test → fix → retest loop this file is built on.
