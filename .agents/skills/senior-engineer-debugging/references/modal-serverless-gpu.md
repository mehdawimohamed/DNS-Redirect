# Modal serverless GPU functions

Modal failures split into: **it never started** (image, config, lookup),
**it started but died or timed out**, **it ran but returned the wrong
thing**, and **it ran twice** (retries). Determine which from Modal's own
records first - the app's logs and the function call's status - before
reading your model code.

```
modal app logs <app-name>          # container stdout/stderr, incl. tracebacks
modal app list                     # is the app actually deployed, in which environment?
```

The Modal dashboard shows each input's status, container logs, and GPU
utilisation, which distinguishes "waiting for a container" from "running".

## "Function not found" / `from_name` fails

`modal.Function.from_name("app", "fn")` looks up a **deployed** function in
a specific **environment**. It fails when the app was only run with
`modal run` (ephemeral) and never `modal deploy`ed, when the app or function
name differs by a character, or when your token/environment points at a
different Modal environment than the one you deployed to (dev vs prod).
Check `modal app list` in the environment your credentials use. Also note
that a *deployed* function keeps running the code from its last deploy: an
edit you made locally is not live until you redeploy - a very common cause
of "I fixed it but nothing changed".

## Works with `modal run`, fails when deployed

Differences to check, in order: secrets (a `modal.Secret` attached in dev
but not on the deployed function), the image (a package installed
interactively, not declared in the image), environment variables, the
volume mounts, and the GPU type (a dev run on a bigger GPU hides an OOM).
The deployed container is built only from the declared image and
attachments; anything else that "just worked" was ambient.

## Timeouts

A function has an input timeout (short by default - minutes, not hours) and
a separate wait on the *caller* side. They fail differently:

- **The function's `timeout` is exceeded**: the container is stopped and
  the call errors. Long jobs (video, cold model load plus generation)
  need a `timeout` set to cover *cold start + run*, not just the run.
- **The caller's `FunctionCall.get(timeout=...)` expires**: this raises a
  timeout in *your* code but does **not** cancel the remote job - it keeps
  running (and billing). Treat it as "not finished yet", not "failed". If
  you then resubmit, you pay twice and may produce duplicate outputs. Poll
  again, or cancel explicitly, and key resubmission on your job id.
- Cold start counts against your latency budget but not always against the
  function `timeout` - measure both separately.

## Retries and "why did it run twice?"

Modal retries an input automatically if the *container* fails (preemption,
out-of-memory kill). Exceptions raised by your code are only retried if you
configured `retries`. Consequences to check when a job produced duplicate
output or a duplicate charge:

- an OOM kill followed by an automatic re-run on the same input,
- `retries=N` around a function that is not idempotent (it writes to an
  output store or calls a paid API each time),
- your own caller resubmitting after a `get` timeout.

Make the function idempotent on a job id (write outputs to a key derived
from it and skip if present), and decide deliberately which failures are
retryable. A deterministic error (bad parameters, a validation failure)
retried three times just triples the cost.

## OOM and concurrency

Memory errors inside a container come in the same three shapes as any
diffusion run (see `ai-inference-and-models.md`). The Modal-specific one:
`@modal.concurrent` (multiple inputs per container) shares one GPU's
memory among concurrent generations. Two requests that fit alone can OOM
together, and it looks random because it depends on timing. Reproduce with
concurrency set to 1; if the error disappears, the fix is lower concurrency
or a bigger GPU, not a retry.

## Cold starts and scaling

Latency of the first call after idle = scheduling a container + pulling the
image + running your `@modal.enter` setup (loading weights) . Levers, in
order of effort: keep weights on a **Volume** instead of downloading per
container; load models once in `@modal.enter` rather than per call; keep
warm capacity with `min_containers`/`buffer_containers` (costs money while
idle); extend `scaledown_window` for bursty traffic; consider CPU/GPU
memory snapshots for very large models. Cap spend and blast radius with
`max_containers`. Diagnose "sometimes slow, sometimes fast" by logging
whether the container was cold (a module-level flag set in `@modal.enter`).

## Volumes: written but not visible

Files written to a Volume by one container are visible to others only
after the writer **commits** the volume and the reader **reloads** it (or
starts fresh). A model download step that forgot to commit, or a running
container that never reloaded, yields "file not found" for a file that
exists in the dashboard. Also avoid many small concurrent writers to one
volume; write outputs to object storage instead.

## Calling from your backend

- Prefer `spawn` + a stored call id for anything longer than a few seconds;
  persist the call id on the job row so a restart of your API can resume
  polling instead of losing the job (`modal_call_id` in the spec's data
  model exists for this).
- Webhooks from Modal to your API need a public HTTPS URL - they cannot
  reach `localhost`. If progress works in production but never in local
  development, that is the reason; poll, or tunnel.
- The credentials your backend uses are a token pair in the environment;
  "authentication failed" after rotating tokens or moving hosts is a stale
  `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET`, not a code bug.

→ `modal.com/docs/guide/functions` (timeouts, retries, scaling) and
`modal.com/docs/examples/comfyapp` (a ComfyUI-on-Modal reference layout).
