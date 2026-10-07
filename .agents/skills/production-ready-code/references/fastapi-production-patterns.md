# FastAPI and Python backends in production

This extends the five checks in the main skill file with patterns specific
to FastAPI and async Python. The reasoning is the same; these are the
concrete shapes it takes in this framework.

## Dependency injection is where reuse and boundaries actually live

Before adding a new `Depends()` function, check what already exists for:
the current user, the database session, a paginator, and per-resource
ownership checks (`get_job_or_404(job_id, user)`). A second, slightly
different "get current user" dependency is the FastAPI version of a
duplicated endpoint - it drifts from the first the moment auth logic
changes in only one of them.

Compose dependencies instead of repeating logic inside handlers:

```
# Good - the ownership check is one dependency, reused everywhere a job is loaded
async def get_owned_job(job_id: UUID, user: User = Depends(current_user),
                         db: AsyncSession = Depends(get_db)) -> Job:
    job = await db.get(Job, job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(404)  # 404, not 403 - don't reveal existence to non-owners
    return job
```

A handler that instead does `db.get(Job, job_id)` and checks ownership
inline is the first of what will become several copies.

## Authorization is a dependency, registered globally - not a per-route habit

Register the auth dependency at the router or app level
(`APIRouter(dependencies=[Depends(current_user)])`, or a global dependency)
so a new route is protected by default, and mark public routes as the
explicit exception. A codebase where every new controller must remember
`Depends(current_user)` individually will eventually ship one that forgot -
and nothing about that route looks wrong until someone finds it. Write the
test that hits every protected route with **no** credentials and asserts
rejection; this is the test that would have caught it.

## Pydantic schemas at the boundary, not deep inside a service

Validate the request body against a `BaseModel` in the handler signature,
not by receiving a raw `dict` and validating manually three functions in.
Keep request/response models separate from the SQLAlchemy models: a
response model that accidentally includes a password hash or an internal
field because it reused the ORM model directly is a boundary failure, not
a typo. Use `response_model` (or an explicit return-shaped schema) on every
route so a field added to the ORM model doesn't silently leak into API
responses.

## Async by default; blocking work runs in a thread, explicitly

An `async def` handler that calls a blocking library (a sync HTTP client,
`Pillow`, a sync DB driver, a sync model/inference SDK) blocks the *entire*
process's event loop, not just that request - every concurrent request
waits. Two acceptable shapes: use an async-native client, or keep the
handler `def` (FastAPI runs it in a threadpool) or wrap the specific
blocking call in `run_in_threadpool`. What is never acceptable is `async
def` plus an un-awaited blocking call "because it's fast enough" - it is
fast enough until the one request that isn't blocks everyone behind it.

## One session per request; eager-load what the response needs

Get the `AsyncSession` from a per-request dependency that closes it after
the request; never a module-level session shared across requests. Decide
the loading strategy at the query that will be serialized, not after a
`MissingGreenlet` error in production - request handlers that return
related data need `selectinload`/`joinedload` up front (see
`data-and-queries.md` for the batching version of this same rule). Set
`expire_on_commit=False` on the session factory so a value read after a
commit doesn't trigger an implicit reload.

## Config and secrets: fail at startup, not at first use

Load configuration once via `pydantic-settings` at startup, with **no
default value for any secret** - a missing required field should raise
before the app accepts a single request, not fall back to `None` and fail
confusingly on the first request that needs it. The same object is then
injected via dependency or `app.state`, not re-read from `os.environ` at
scattered call sites (which is also how a stray literal fallback sneaks
in later).

## Idempotency and statelessness for FastAPI specifically

- `BackgroundTasks` runs in-process after the response; it is not durable.
  A restart loses it silently, with no retry and no record. Anything that
  must actually complete - charging credits, calling a paid GPU function,
  sending a receipt - belongs in a persisted job a worker processes, not a
  background task.
- Running `uvicorn --workers N` means N processes with **no shared memory**.
  An in-memory dict used for rate limiting, SSE subscriber lists, or a
  cache is invisible across workers and silently wrong under more than one
  worker. If it must be shared, it belongs in the database or a cache
  service, not a module-level `dict`.
- A webhook handler (payment, GPU-provider callback) must be safe to
  receive twice: check a uniqueness constraint or an already-terminal
  status before applying its effect, in the same transaction as applying
  it.

## Prove it: FastAPI-specific evidence

- Use `httpx.AsyncClient(transport=ASGITransport(app=app))` (or
  `TestClient`) plus `app.dependency_overrides` to test authorization
  paths without standing up real infrastructure - override
  `current_user` to prove both "wrong role" and "no credentials at all"
  are rejected.
- For a claim about streaming (SSE) working correctly, the test that
  proves it opens the stream, asserts the events arrive in order, and
  asserts the connection is properly closed on completion - not just that
  the endpoint returns `200`.
- For a claim about a background/worker path, the test drives the actual
  worker function against a seeded job row and asserts the row's final
  state - not that the code "looks like it would work".

→ `senior-engineer-debugging/references/fastapi-and-python.md` if
something in this area is actually broken right now, not just being
written - that file is organized by symptom rather than by rule.
