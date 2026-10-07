# AI model inference and media generation services

Serving image/video generation (diffusers pipelines, ComfyUI workflows, or
a remote GPU platform like Modal) is application code with two properties
that change what "production-ready" means: **a single unit of work is
expensive** (seconds to minutes of GPU time, real money) and **the result
is a large binary**, not a row. The five checks in the main skill file
still apply; here is what they mean in this domain.

## Reuse: one call path per model, one adapter per provider

Before adding a second place that calls a model or workflow, check for an
existing provider/adapter for it. Two independent call sites for "generate
an image" that each build their own request payload will drift - one
picks up a new parameter or a bug fix and the other doesn't. Put every
call to a given model or GPU platform behind one interface (a
`InferenceProvider`, or similar) with one implementation per backend
(mock, local, Modal, ComfyUI) and one place that knows the model's actual
parameter names and defaults. Everything upstream (job creation, pricing,
UI) talks to the interface, never to the provider's SDK directly - this is
the reuse-and-boundaries rule applied to a trust boundary that also happens
to bill money.

**Also don't force unrelated modes through one call shape too early.**
Text-to-image, image-to-image, and video have different required inputs
and cost models; wait for the third genuinely-identical case before
collapsing them into one function with five optional parameters (the same
"rule of three" as any other abstraction).

## Data access at scale, applied to jobs and outputs

- A job's status, progress and result are read far more often than
  written (polling, gallery listings, dashboards). Index the columns a
  listing filters or sorts on (`user_id, created_at`; `status`), and
  paginate every listing that can grow - a user's history is exactly the
  kind of unbounded list `data-and-queries.md` warns about.
- Multi-step state changes on a job - reserve credits, mark running, write
  the result, charge, and only then mark complete - belong in transactions
  at each step, not one long optimistic sequence that leaves a job
  "running" forever if the process dies in the middle. A stuck-job sweeper
  that reconciles orphaned `running` rows against the provider's real
  status is the operability half of this.
- Don't store large binary output in the primary database. Object storage
  for the file, a row for its metadata and a pointer - the same "select
  only what the task needs" principle, at binary-blob scale.

## Security by default: input, uploads, and generated output

- **User-supplied prompts and uploaded images/video are untrusted input**
  at the same boundary as any other request body. Validate file type and
  size *before* it reaches the model (magic-byte check, not just the
  filename extension), and validate prompt length/parameters against a
  schema before spending any GPU time on them.
- **Every signed URL for a generated asset is a capability**: a
  long-lived or guessable URL to private content is a straightforward data
  leak. Short expiries, and re-derive the owner check on every access
  rather than trusting a URL that was valid once.
- **Least privilege for the inference credential**: the backend's key to
  the GPU platform is a secret like any other - no fallback literal, and
  scoped to only what it needs (a token that can also delete deployed apps
  is broader than a generation service requires).
- **Content produced by a generative model is still output your service
  is responsible for.** Whatever moderation/safety layer the product
  requires runs as a mandatory step in the pipeline, not an optional
  post-processing script someone can forget to run. If that seam isn't
  built yet, the code should fail closed (don't serve unmoderated output),
  not silently skip the check.

## Idempotency for spend, not just for correctness

This is the sharpest way this domain differs from typical CRUD: a
duplicate write is usually just wasted rows, but a **duplicate generation
call is wasted GPU money**, every time. Make submission idempotent on a
job id, not just at the payment layer: a webhook or retry that resubmits
the same job to the same provider call should be a no-op if a call is
already in flight or done, not a second paid generation. Store the
provider's own call/request id on the job the moment you have it, so a
process restart can *reconnect* to an in-flight generation instead of
either losing track of it or starting a second one.

Charging credits and recording the debit belong in the same transaction as
marking the job complete, guarded by a uniqueness constraint on
`(job_id, reason)` or equivalent - so a completion handler invoked twice
(a webhook redelivered, a poll and a webhook both firing) charges once.
Reserve-then-charge-or-release, never charge speculatively before the
result exists.

## Scale and operability: GPU capacity is not like CPU capacity

- **Timeouts must cover cold start, not just the model's run time.** A GPU
  provider that scales to zero can take tens of seconds to minutes to
  start a container before your model even loads; a timeout sized only for
  steady-state inference will fail every cold request.
  the same request twice, doubling spend - treat "my wait timed out" and
  "the job failed" as different facts, and reconcile with the provider's
  own status before resubmitting.
- **Concurrency limits protect both your budget and your GPU memory.** Cap
  how many generations one user (and the system as a whole) can have in
  flight; without it, a burst of requests either exhausts GPU memory on a
  shared container or runs up an unbounded bill. This is a rate limit, but
  the resource being protected is money and hardware, not just CPU.
- **A stateless API process; a durable job store.** Progress, status and
  the provider call id live in the database, not in the memory of the
  process that happened to submit the job - so a restart, redeploy, or
  second instance can pick up where an in-flight generation left off.
- **Log the parameters that determine cost and correctness** on every job
  (model/version, resolution, frame count or duration, seed, which
  provider handled it) - this is what makes "why did this job cost more
  than expected" or "why does this output look wrong" answerable without
  reproducing the exact request days later.
- **A daily or per-user spend ceiling that pauses new submissions and
  alerts**, not just a per-request cost estimate - the aggregate failure
  mode (a bug that resubmits in a loop, a scraper hammering a free preset)
  is the one that actually damages a budget.

## Prove it, for generation specifically

- The test that would have failed before a fix and passes after it, for
  this domain, usually means driving the actual state machine (reserve ->
  submit -> complete/fail -> charge/release) against a mock provider with
  a deliberately slow or failing response - not asserting that a function
  returns the right dict in isolation.
- A concurrency test for credit reservation (many simultaneous
  reservations against a balance that only covers a few) is exactly the
  kind of "changes where being wrong is expensive" case
  `testing-and-verification.md` says deserves real proof, not a read of
  the code.
- Don't claim a generation pipeline "works" from one successful happy-path
  run. Show the failure path too: a provider timeout releases the
  reservation and reports a clear error, and a job stuck mid-flight is
  either recovered or explicitly surfaced, not silently lost.

→ `senior-engineer-debugging/references/ai-inference-and-models.md`,
`comfyui-workflows.md`, and `modal-serverless-gpu.md` for diagnosing a
specific failure once one is happening, rather than designing against it
up front.
