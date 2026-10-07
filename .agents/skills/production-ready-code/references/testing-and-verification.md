# Prove it, don't claim it

This file is about the gap between "I believe this works" and "I have
evidence this works," and why that gap matters more in agent-written code
than almost anywhere else - there's no colleague in the loop by default to
notice when a claim and the actual evidence quietly drift apart.

## A test is the proof, not the description, of a fix

When you fix a bug or add behavior, the test that matters is one that
would have failed against the old code and passes against the new code.
A test that only exercises the new code path in isolation, written after
the fact to match what the fix does, proves the test agrees with the fix -
it doesn't prove the fix addresses the original problem. Where practical,
actually check this: run the new test against the previous version of the
code and confirm it fails there.

## Don't let exceptions disappear

An empty catch block, or a catch block that only logs and lets execution
continue as if nothing happened, converts a real failure into silent
wrong behavior somewhere downstream - which is much harder to diagnose
than the original error would have been. Catch only what you can
meaningfully handle, and let everything else propagate as a typed,
specific failure.

## Say which claim you're making

"The code looks correct" and "I ran it and observed the expected result"
are different claims with different reliability. Be explicit about which
one you're making, especially when reporting results back to someone who
isn't going to re-derive them:

- If you ran something and have the output, show the output, not a
  summary that could have been written before running it.
- If you could not run something - no access to a real device, no
  external service available, a build target unavailable in the current
  environment - say so explicitly and say why, rather than omitting it or
  letting a checked box imply it was verified.
- If a claim rests on reading the code rather than executing it, say that
  plainly instead of presenting it with the same confidence as a claim
  you tested.

## Check your own numbers before reporting them

Test-suite counts, coverage percentages, and findings tables are the kind
of thing that's easy to state confidently and get wrong - a total that
doesn't match the sum of its parts, a per-file count that doesn't match
the file you're citing. Before including a number in a report, verify it
against the tool's own raw output rather than an estimate, and make sure
the individual figures actually add up to any total you state alongside
them. One number that doesn't reconcile is often the first thing a
careful reader checks, and it undermines trust in everything else in the
same report - reasonably, since if that number wasn't checked, it's fair
to wonder what else wasn't.

## Match the depth of verification to what changed

A one-line copy change doesn't need the same evidence as a change to
authorization, pricing, or a database migration. Spend the real proof -
integration tests against a real database, a concurrency test, a run
against seeded data - on the changes where being wrong is expensive, and
say plainly when something lower-stakes was checked more lightly.
