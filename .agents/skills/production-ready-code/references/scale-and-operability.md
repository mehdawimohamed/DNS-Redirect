# Built to scale out, not just to work once

"Scales" mostly isn't about clever code - it's about whether a process can
be killed, restarted, or multiplied without anything breaking, and whether
the people running it can tell what's wrong when something does.

## Statelessness

A process should be interchangeable with a fresh copy of itself. That
means:

- **No session, cache, or uploaded file living only in one process's
  memory or local disk**, if that data needs to survive a restart or be
  visible from a different instance handling the next request. It belongs
  in a database, a shared cache, or object storage instead.
- **In-memory state is fine for request-scoped or genuinely disposable
  data** - the moment a second instance or a restart needs to see it, it
  isn't disposable anymore.

## Configuration comes from the environment

Configuration - URLs, feature flags, credentials, per-environment
behavior - is read from environment variables or a config service, not
hardcoded or branched on inside the code (`if (env === 'staging') { ... }`
sprinkled through business logic is a sign config should have been a
value, not a branch).

## Fast, honest startup and shutdown

- Validate all required configuration once at boot and fail immediately
  with a clear message if something required is missing or invalid -
  don't let a bad config limp into "running" and fail later on the first
  request that needs the missing piece.
- Handle a graceful shutdown signal by finishing in-flight work (or
  cleanly rejecting new work) before exiting, rather than dropping
  requests mid-flight the moment the process is told to stop. This is
  what makes rolling deploys and autoscaling safe.

## Retries and idempotency (see also data-and-queries.md)

Processes get killed mid-request, networks drop, and clients and queues
retry. Design every side-effecting operation assuming it might run twice,
rather than hoping it won't.

## Logging and observability

- Write structured log events to standard output and let the runtime
  environment handle collecting and routing them, rather than the
  application managing its own log files and rotation.
- At minimum, be able to answer "is this broken, and for whom" from logs
  and metrics alone, without needing to reproduce the issue locally: log
  enough context (a request ID, the relevant entity IDs, the outcome) on
  both success and failure paths, not just on errors.
- Metrics that matter most for a request-serving system are rate, error
  rate, and duration for each significant path - enough to notice a
  problem before a user reports it.

## Ship a real rollback, not a paragraph about one

A risky change should ship with an actual off switch: a feature flag that
can be flipped without a redeploy, or a rollback that's a single runnable
command someone can execute under pressure - not a set of manual steps
written down and never rehearsed. If you can't state the exact command or
flag that undoes a change, that's worth surfacing before the change ships,
not after something goes wrong.
