---
name: senior-engineer-debugging
description: >-
  Applies senior-engineer root-cause investigation discipline whenever debugging an error, exception, crash, failing test, regression, or unexplained behavior, instead of guessing at fixes or patching symptoms. Forces reproduction, evidence-gathering, and one falsifiable hypothesis before any code changes, and treats a fix as unproven until the exact original failure is re-run and passes. Includes stack-specific playbooks for NestJS, Drizzle, PostgreSQL, Next.js, Tailwind, shadcn/ui, Flutter, Python/FastAPI (blocked event loops, async SQLAlchemy errors, SSE buffering), and AI/media-generation systems - model inference (OOM, black/NaN output), ComfyUI workflow/API errors, Modal/serverless-GPU functions, and tracing a generation request across jobs, credit ledgers, and payment webhooks. Trigger this for a pasted stack trace or error message, "why is this failing", "investigate this bug", "this doesn't make sense", "fix this" - not only when a debugging process is explicitly requested.
---

# Senior-engineer debugging

You are not being asked to make an error message go away. You are being
asked to find out why the system was able to reach a state where that
error was possible, remove that condition, and leave behind proof that it's
actually gone. A change that stops the symptom while the underlying
condition stays in the code is not a fix - it's a delay, and the next
person to hit it (often you, later, with less context) pays more than you
saved.

"AI slop" debugging has a recognizable shape: paste the error, produce a
plausible-looking change, apply it without checking whether it addresses
what actually happened, report success. It matches the error's vocabulary
without explaining its cause - a try/catch around the failing line, a `??`
or `?.` that hides a value that should never have been null, a dependency
bump applied on a hunch. This skill replaces that with the loop experienced
engineers actually use: observe, reproduce, form one hypothesis you could
be proven wrong about, test it as cheaply as possible, trace the failure to
where it originates rather than where it was noticed, fix that, and verify
against the exact case that started the investigation.

## Before you touch any code

- **Read the entire error, not just the first line.** The exception type at
  the top is often the symptom; the cause is frequently in a "caused by" /
  inner-exception chain, an earlier log line, or the last stack frame that
  is actually your code rather than a library or runtime internal.
- **Reproduce it before you explain it.** A cause you can't demonstrate is a
  guess wearing a lab coat. If you cannot reproduce the failure, say so
  explicitly and say what you'd need in order to - don't invent an
  explanation for a black box.
- **Check what changed.** Recent commits, recent dependency bumps, recent
  schema migrations, recent config or environment changes. Most bugs in a
  system that used to work are regressions, and the recent diff is the
  highest-value evidence available before you've written a single new line.
- **Read the actual code at the failure site right now**, not your memory
  of what that function probably does. Assumptions about code you haven't
  reread in this session are where wrong hypotheses come from.

## The investigation loop

1. **Observe.** Capture the exact error text, the exact conditions that
   trigger it (always vs. intermittent, which environment, which input),
   and anything that changed recently. Write these down before guessing -
   memory of "what I probably saw" is unreliable a few steps later.
2. **Reproduce.** Get a minimal, reliable way to trigger the failure. For
   an intermittent bug, the immediate goal is making it happen on demand,
   not fixing it - an intermittent bug you can't yet reproduce needs
   isolation of the varying condition (timing, concurrency, specific data,
   specific environment) before a fix is even meaningful.
3. **Form one hypothesis.** State it as a sentence you could be proven
   wrong about: "X fails because Y." List the plausible candidates and
   test the cheapest-to-disprove one first, not the one that feels most
   likely - fast elimination beats slow confirmation.
4. **Test it with the smallest possible probe.** A log line, a breakpoint,
   a targeted query, reading one specific function - not a rewrite. If the
   test doesn't confirm the hypothesis, that's a result, not a failure:
   record it and move to the next candidate rather than layering a second
   guess on top of the first.
5. **Trace to the origin, not the detection site.** Follow the bad value
   or bad state backward through the call chain until you find where it
   was actually introduced. The most common shape of a symptom fix is
   patching the function that happened to crash instead of the function
   that produced the invalid input three calls earlier.
6. **Fix the cause, then verify against the original reproduction.**
   Re-run the exact case that started the investigation. "This should fix
   it" and "I ran the original failing case and it now passes" are
   different claims - only report the second one as done.
7. **Look for the same defect elsewhere.** The assumption that broke here
   is often duplicated in sibling code, copy-pasted into another handler,
   or repeated in another layer of the stack.

→ `references/investigation-method.md` for the full reasoning behind this
loop, the classic nine debugging rules it's built on, bisection technique,
and how to keep a useful audit trail across a long investigation.

## What this rules out

- **Shotgun debugging** - changing several things at once so that if it
  works, you don't actually know which change did it (and you've likely
  introduced unrelated risk with the others).
- **Symptom patching** - a broad catch block, a fallback value, or a null
  check that makes the crash stop without addressing why the invalid state
  existed.
- **Assumption cascades** - "I think it's probably X" treated as
  established fact and built on, instead of tested.
- **Declaring victory without re-running the failure** - reporting a fix as
  done because the change looks right, not because you watched the
  original failing case pass.
- **Inventing a root cause for a bug you never reproduced** - a
  narrative that fits the error message is not the same as evidence.

→ `references/anti-patterns.md` for what each of these looks like in code,
why it fails, and the disciplined alternative.

## Route to the right playbook

Once you have a reproduction and a rough sense of where it lives, use the
stack-specific reference for that layer. Each one covers the failure modes
that are common, non-obvious, or easy to "fix" at the wrong layer in that
technology.

- **NestJS / Node backend** - "Nest can't resolve dependencies", circular
  dependency errors, a provider that behaves differently than its module
  wiring suggests, guard/interceptor/pipe ordering, unhandled promise
  rejections inside providers → `references/nestjs-and-node.md`
- **Drizzle + PostgreSQL** - wrong or missing rows, a query that runs once
  per row instead of once, `relation does not exist` / schema drift after
  a migration, a query that's fast locally and slow in production, "too
  many connections" or a hung pool → `references/drizzle-and-postgres.md`
- **Next.js / React** - hydration mismatch warnings, "needs useState...
  mark with use client", data that looks stale or stuck, a server action
  or route handler that fails silently → `references/nextjs-and-react.md`
- **Tailwind CSS / shadcn/ui** - a class that exists in your source but has
  no effect, styling that works in dev but not in the production build, a
  shadcn component that renders unstyled after install or a theme change
  → `references/tailwind-and-shadcn.md`
- **Flutter** - a red or grey screen, `RenderFlex overflowed`, `setState()
  called after dispose()`, a null check operator failure, UI that doesn't
  update after state changes → `references/flutter.md`
- **Python / FastAPI backend** - the whole API stalls under load, a `422`
  with no idea why, `MissingGreenlet` from async SQLAlchemy, an SSE stream
  that buffers instead of streaming, "works locally, not in the container"
  → `references/fastapi-and-python.md`
- **AI model inference (diffusers, image/video generation)** -
  `CUDA OutOfMemoryError`, black or NaN output, non-reproducible results
  from the same seed, output that ignores a parameter, a wrong-looking
  video (frame count, fps, resolution) → `references/ai-inference-and-models.md`
- **ComfyUI workflows and API** - `Prompt outputs failed validation`,
  `node_errors`, a prompt that "succeeds" but produces nothing new
  (caching), misread WebSocket execution messages, a workflow that works
  in the UI but not through the API → `references/comfyui-workflows.md`
- **Modal (or similar serverless GPU) functions** - function not found,
  works with `modal run` but not deployed, timeouts, unexpected retries or
  duplicate runs, OOM under concurrency, files missing from a Volume →
  `references/modal-serverless-gpu.md`
- **A generation request end to end** (job stuck in queue/running, a
  progress stream that never updates, charged-but-no-result or
  charged-twice, a webhook signature mismatch, a payment credited too
  early) - spans several of the layers above, so trace it hop by hop first
  → `references/generation-pipeline-tracing.md`

If the failure spans layers (an API error that's really a query problem, a
UI bug that's really a caching problem), start the loop above at the layer
closest to where the wrong value first appears, then follow it - don't
guess which reference applies before you've traced the data.

## Before you say it's fixed

1. Can you state the root cause in one sentence, and does it match the
   exact reproduction - not a plausible-sounding story?
2. Did you re-run the exact case that originally failed, and does it now
   pass? Not "should," "does."
3. Does the fix change behavior at the place the bad state was introduced,
   rather than only where it surfaced?
4. Is there a test that would have failed before this change and passes
   after it? If not, say so explicitly rather than implying coverage that
   doesn't exist.
5. Did you change only what the evidence pointed to, or are there several
   speculative changes bundled together where you can't say which one
   mattered?
6. Is any part of the change silently absorbing the error instead of
   removing its cause - a broad catch, a fallback value, an optional-chain
   that papers over a value that should never have been missing?
7. Did you check whether the same root cause exists anywhere else in the
   codebase?
8. Can you explain, in plain language a teammate could follow, why the
   system was able to get into the failing state in the first place?

## How to work

Prefer a targeted log line, a specific query, or a specific function read
over dumping an entire file or directory into context - you want the
evidence that tests your current hypothesis, not everything that might be
related. Make the smallest edit that fixes the traced cause rather than
rewriting the surrounding code while you're in there; a debugging session
is not the moment to also refactor, because it makes it harder to know
which change actually mattered and harder to revert cleanly if the
hypothesis turns out to be wrong.

## Adapting this to a stack outside the list above

The five reference files cover this project's usual stack, but the loop
above is the actual skill - it applies to any language or framework. On
something unfamiliar, spend a minute finding that ecosystem's own
diagnostic tools (its debugger, its structured logging, its query planner,
its browser or platform inspector) and apply the same reasoning: observe,
reproduce, one testable hypothesis, trace to the origin, fix, verify
against the original failure.
