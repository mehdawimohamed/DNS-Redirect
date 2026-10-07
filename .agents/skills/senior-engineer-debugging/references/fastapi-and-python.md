# FastAPI and Python backends

## First step for almost anything here: find out which thread of control is misbehaving

FastAPI failures fall into three families that look alike from the outside
("the API is slow / hangs / returns 500") and have completely different
causes: the **event loop is blocked**, a **resource lifecycle is wrong**
(sessions, clients, pools), or a **request was rejected before your code
ran** (validation, auth, CORS). Decide which family you are in from the
evidence before reading any handler code:

- Latency spikes that hit *every* endpoint at once, including `/health`
  → the event loop is blocked.
- One endpoint fails, others fine, error mentions a session, greenlet or
  connection → resource lifecycle.
- A `422`, `401`, `403` or a CORS error in the browser and *no* log line
  from your handler → it never reached your code.

## The whole API freezes: a blocked event loop

**Root cause, usually**: an `async def` handler (or an `async def`
dependency) calls something blocking - `time.sleep`, `requests.get`, a
synchronous DB driver, a synchronous SDK call (an S3 client, a Modal or
model client), a large `Pillow`/`ffmpeg` job, or a CPU loop. FastAPI runs
plain `def` handlers in a threadpool, but it trusts an `async def` handler
to only await non-blocking work, so one blocking call stalls the single
event loop and every other request waits behind it.

**Diagnose**:

1. Reproduce with two concurrent requests: one to the suspect endpoint and
   one to `/health`. If `/health` waits for the suspect call to finish,
   the loop is blocked.
2. Turn on asyncio debug mode (`PYTHONASYNCIODEBUG=1`, or
   `asyncio.run(..., debug=True)`) - it logs any callback that holds the
   loop longer than the slow-callback threshold and names it.
3. Read the suspect handler for any call that is not `await`ed and does
   I/O or heavy compute.

**Fix at the right layer**: use an async client library, or keep the
handler a plain `def` so it runs in the threadpool, or wrap the one
blocking call with `await run_in_threadpool(fn, ...)` /
`anyio.to_thread.run_sync`. Do not "fix" it by adding more workers - that
hides the blocking call behind more processes and it comes back at the
next traffic increase. Note the threadpool is finite (the default is
around 40 threads): a sync endpoint that blocks for a long time under load
can exhaust it, which looks the same from outside. A sync `def` dependency
also runs in the threadpool, which is sometimes the surprise.

→ `github.com/zhanymkanov/fastapi-best-practices` (async routes section)
for the sync/async decision table.

## `MissingGreenlet`, "Instance is not bound", and stale attributes (SQLAlchemy async)

**`sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called`**
means something touched the database implicitly - almost always a
**lazy-loaded relationship** accessed after the query finished, often
inside response serialization, where nothing awaits it. Sync SQLAlchemy
hides this by loading lazily; async cannot.

Work through it in this order:

1. Find the attribute in the traceback. Is it a relationship
   (`order.items`, `user.jobs`)? If yes, the query that loaded the parent
   did not eagerly load it.
2. Add the load to the query: `select(Order).options(selectinload(Order.items))`
   (or `joinedload` for a to-one relation). This is also the N+1 fix, so
   you are removing a performance bug at the same time.
3. To make the mistake loud everywhere instead of intermittent, set
   `lazy="raise"` on relationships, so an unplanned lazy load fails in
   tests, not in production.
4. If the failing attribute is a plain *column* right after `commit()`,
   the session's default `expire_on_commit=True` expired it. Either
   refresh explicitly, return data captured before the commit, or set
   `expire_on_commit=False` on the async session factory.

Do not respond by wrapping the access in `run_sync` or by switching the
endpoint to a sync session - that trades a loud error for a hidden
performance problem.

**Also check the session lifetime**: one `AsyncSession` per request via a
dependency that yields and closes it; the engine created once (lifespan),
never per request. A session held across `await`s of unrelated slow work
(a Modal call, an HTTP call) keeps a pooled connection and a transaction
open, which shows up as pool exhaustion or lock waits under load (see
`drizzle-and-postgres.md` for the Postgres-side lock query).

## Validation errors (`422`) and "my handler never ran"

FastAPI validates path, query, header and body *before* calling the
handler. A `422` body contains `loc` (where), `msg` and `type`; read
`loc` first - it says whether the bad value was in the `body`, `query`, or
`path`. Common real causes:

- The client sends JSON but the handler expects a query parameter (or the
  reverse), because a scalar parameter with a default is treated as a
  query parameter, and a Pydantic model as the body.
- Two body models in one handler: FastAPI then expects them nested under
  their parameter names.
- Pydantic v2 is stricter than v1 about coercion (for example a numeric
  string into an int in strict fields), and `Optional[X]` without a
  default is *required but nullable*, not optional.
- A `Literal`/`Enum` value the client spells differently.

**CORS "failed" in the browser with no server log**: the browser blocks
before or after the request; check the response headers, not the handler.
Usual causes: the frontend origin is not in `allow_origins`;
`allow_credentials=True` combined with `allow_origins=["*"]` (not allowed
by the spec - list explicit origins); `CORSMiddleware` added *after* a
middleware that returns early; or the error is really a `500` whose
response carries no CORS headers, so the browser reports it as CORS. Curl
the endpoint directly first to see the true status.

## Startup, lifespan, and "works locally, not in the container"

- Shared clients and pools belong in the `lifespan` context (created on
  startup, closed on shutdown) and are reached via the app or request, not
  module globals created at import time. Import-time side effects (opening
  connections, reading env) run in every worker and in tools like Alembic.
- **Settings**: a required env var that is missing should crash startup
  with a clear error (`pydantic-settings` does this if the field has no
  default). "Works locally" is frequently a `.env` file that the container
  never received - compare `printenv` inside the running container with
  what the code expects.
- **`localhost` inside a container** is the container itself. The API
  reaching Postgres in another compose service must use the service name
  (`db:5432`), not `localhost`.
- **Workers**: `uvicorn --workers N` gives N separate processes. In-memory
  state (a dict of SSE subscribers, a cache, a rate-limit counter) is not
  shared, which produces bugs like "the progress event went to a different
  process than the one holding the client's stream". Reproduce with
  `--workers 2`; the fix is a shared backing service (database
  `LISTEN/NOTIFY`, Redis), not pinning to one worker.

## Work that silently disappears: `BackgroundTasks` and fire-and-forget

`BackgroundTasks` runs after the response in the same process. If the
process restarts or crashes, the task is gone with no record, and an
exception inside it is logged (if at all) after the client already got a
`200`. When "the job was created but never ran", check whether the work
was handed to `BackgroundTasks` or `asyncio.create_task` (a task whose
reference is dropped can even be garbage-collected mid-run). Durable work
belongs in a job row processed by a worker, not in the request process.

## Streaming (SSE) that arrives all at once, or never

Server-Sent Events that work on `localhost` and stall behind a proxy are
buffering problems, not application bugs:

1. `curl -N` the endpoint directly on the container port. If events stream
   there, the app is fine and the proxy is at fault.
2. Check the response headers: `Content-Type: text/event-stream`,
   `Cache-Control: no-cache`, and `X-Accel-Buffering: no` (Nginx). FastAPI's
   `EventSourceResponse` (`fastapi.sse`, added in FastAPI 0.135) sets these;
   with a raw `StreamingResponse` you set them yourself.
3. Proxy: Nginx needs `proxy_buffering off` and a long `proxy_read_timeout`;
   Caddy's `reverse_proxy` can set `flush_interval -1`; make sure
   compression is not applied to `text/event-stream` at any layer, since
   gzip forces buffering.
4. Idle connections get closed by load balancers. Send a comment ping
   (`: ping`) every ~15-30 seconds.
5. Server side: a generator that never checks for client disconnect keeps
   running (and spending money) after the tab closes - confirm it stops.
6. Browser side: the native `EventSource` cannot send an `Authorization`
   header; a stream that returns `401` immediately is usually that. Use a
   fetch-based SSE client or a short-lived stream token.

→ `fastapi.tiangolo.com/reference/sse/`.

## Alembic and schema drift

- `alembic revision --autogenerate` produces an empty migration when the
  models were never imported into the module Alembic loads - import every
  model module in `env.py` (or a single `models/__init__.py`).
- Autogenerate does not detect everything (server defaults, some enum
  changes, check constraints). Read the generated file; do not trust it.
- `relation ... does not exist` means the database and the migration
  history disagree - see `drizzle-and-postgres.md` for the general method
  (check the version table, do not mix ways of changing the schema).

## Debugging tools worth reaching for

`pytest` with `httpx.AsyncClient(transport=ASGITransport(app=app))` to
reproduce a request without a server; `app.dependency_overrides` to isolate
auth or a slow dependency; `--log-level debug`; `py-spy dump --pid <pid>`
against a hung worker to see exactly which line every thread is stuck on
(this settles "blocked loop vs. stuck DB call" in one command).
