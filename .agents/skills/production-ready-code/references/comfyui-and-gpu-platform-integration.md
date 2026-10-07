# ComfyUI and GPU-platform integration (Modal and similar)

Building the layer that calls ComfyUI or a serverless GPU platform like
Modal from your backend has its own reuse, boundary and scale concerns,
distinct from generic AI-inference production code.

## Reuse: the workflow JSON is a versioned artifact, not a string in code

Treat a ComfyUI workflow (exported in **API format**) the way you'd treat a
database migration: check it into version control, one file per workflow,
and load it rather than constructing the JSON inline in application code.
Two call sites that each build a slightly different inline copy of "the
image workflow" are the same drift problem as duplicated DTOs - the moment
someone fixes a node id or a parameter in one, the other silently goes
stale.

Centralize the **injection** logic too: one function that takes a template
and a small set of named parameters (prompt, seed, image, dimensions) and
returns the submitted JSON, used everywhere a workflow is submitted. This
is also where you validate that every parameter you're about to inject
actually maps to a node/field that exists in the template - failing loudly
here is far cheaper than a `400` from ComfyUI three network hops later.

## Boundary: never let a template be edited per-request without validation

If the product lets users choose options that vary the workflow (a preset
system, a set of exposed sliders), the mapping from "user-controllable
value" to "workflow field" is itself a boundary: a value must be validated
against a known-safe range/enum for that field *before* injection, the
same way any other user input is validated at the edge. Don't let a
user-facing field write into just any node/key path in the JSON -
constrain it to an explicit allowlist of injectable fields per template,
so a malformed or malicious value can't repoint an unrelated node (a
loader, an output path) that was never meant to be user-controlled.

## Idempotency for a queued, stateful execution system

ComfyUI queues one prompt at a time per server and caches results by node
inputs. Two implications for correctness:

- **Resubmitting an identical graph (same seed, same inputs) can return a
  cached result instead of a fresh generation.** If the product's
  contract is "every request produces a new image", the submission code
  must inject a fresh seed (and record the resolved seed on the job) -
  this is a correctness requirement, not an optimization detail.
- **A prompt id, once submitted, is the unit of idempotency for your
  system.** Store it on the job the moment `/prompt` returns it, so a
  process restart reconnects via `/history/{prompt_id}` instead of
  resubmitting the same work - resubmission here means a second paid GPU
  run, not just a duplicate row.

## Scale and operability: one queue, one GPU, plan around both

- A single ComfyUI server executes one prompt at a time. If the product
  needs concurrency, that means multiple server instances behind your own
  queue/dispatch, not more requests thrown at one instance - design the
  job dispatcher to know how many workers exist and to queue past that,
  rather than assuming ComfyUI will do it for you.
- On a serverless GPU platform, **cold start is part of your SLA, not an
  implementation detail to hide** - size timeouts, user-facing progress
  messaging, and any "is this taking too long" alerting around cold-start
  time plus run time, and keep them distinct in your logs so cold-start
  regressions are visible separately from model regressions.
- **Model weights and custom nodes belong in the deployed image/volume**,
  never installed by hand on a dev instance and assumed to carry over.
  "Works when I test it, missing when deployed" is what happens when the
  image build doesn't fully declare what the workflow needs; treat the
  image definition as the single source of truth for what's installed.
- **A daily spend/job cap on the GPU-calling path specifically** - a bug
  that resubmits in a loop, or a scraper hammering a public endpoint, turns
  into a GPU bill far faster than a CPU-only bug turns into a compute bill.
  Pair this with a concurrency cap per user and in aggregate.

## Prove it: integration-specific evidence

- A test that submits a **known-good** template through the real injection
  function and asserts the resulting JSON matches expectations field by
  field is worth more here than a unit test of the injection function in
  isolation - the failure mode is almost always "the diff between what I
  meant to submit and what got submitted", and that's exactly what this
  test catches.
- Where a real ComfyUI/GPU platform call is impractical in CI, a recorded
  fixture of a real `/history` response (or the platform's real call
  shape) is a more honest test double than a hand-written mock that
  encodes assumptions about the response format you haven't verified
  against the real thing.
- State plainly which parts were verified against a live server/platform
  call and which were only verified against a mock - this is exactly the
  "say which claim you're making" discipline from
  `testing-and-verification.md`, applied to a domain where the mock and
  the real service can drift apart silently.

→ `senior-engineer-debugging/references/comfyui-workflows.md` and
`modal-serverless-gpu.md` when something in this integration is actually
failing right now.
