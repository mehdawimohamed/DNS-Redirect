# Drizzle and PostgreSQL

## First step for almost anything here: see the actual SQL

A surprising number of "Drizzle is doing the wrong thing" reports are
actually "I assumed the wrong query was being generated" reports. Before
theorizing about Drizzle's behavior, look at the real, generated SQL:

```
// See the query without running it
const { sql, params } = db.select().from(orders).where(eq(orders.id, id)).toSQL();
```

```
// See every query Drizzle actually runs, as it runs
const db = drizzle(pool, { logger: true });
```

→ `orm.drizzle.team/docs/goodies`. This one habit resolves a large share of
"wrong data" and "N+1" investigations before you've touched application
logic, because it tells you immediately whether the problem is in the
query Drizzle built or in what your code does with the result.

## N+1: one query per row instead of one query total

**Symptom**: a list endpoint gets slower in direct proportion to the
number of items returned, and `{ logger: true }` shows the same query
shape repeating once per row.

**Bad** - a loop of single-row lookups:
```
const bookings = await db.select().from(bookingsTable);
for (const booking of bookings) {
  booking.guest = await db.query.users.findFirst({ where: eq(users.id, booking.guestId) });
}
```

**Good** - one query with the relation attached:
```
const bookings = await db.query.bookings.findMany({
  with: { guest: true },
});
```

The gotcha specific to Drizzle: the relational query API (`db.query.x`,
and the `with` option) only works for relations you've declared with the
separate `relations()` helper - defining a `pgTable` alone is not enough.
If `with` silently returns `undefined` for a relation you expected, check
that a matching `relations(bookings, ({ one }) => ({ guest: one(users,
...) }))` actually exists and is passed into `drizzle(pool, { schema })`.

## Migration drift: `relation does not exist` / `column does not exist`

This means the database's actual structure and what your schema code
believes about it have diverged. Before writing a new migration, establish
which one is actually wrong:

1. Check what's really been applied: query the `__drizzle_migrations`
   tracking table (or the equivalent for your migration setup) rather than
   assuming the latest file in your `drizzle` folder was run.
2. Check whether `drizzle-kit generate` (which writes a migration file)
   and `drizzle-kit push` (which applies schema changes directly, with no
   file) have been mixed on the same database. Using both against one
   environment is the most common way schema and migration history stop
   agreeing with each other - `push` changes the database without a
   corresponding migration file for `generate`/`migrate` to know about.
3. Only after confirming which side is stale, write the fix: either a new
   migration that reconciles the database to what the schema file says, or
   a schema correction if the code was wrong about what's actually there.

## Slow queries: measure before changing anything

Don't guess at an index from reading the query - ask Postgres what it's
actually doing:

```
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.total, c.email
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'pending';
```

`EXPLAIN` alone predicts a plan from statistics without running anything;
`EXPLAIN ANALYZE` actually executes the query and reports real timings and
real row counts per step - that's almost always what you want for
diagnosis. For a write query you don't want to actually commit while
diagnosing, wrap it:

```
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status = 'processed' WHERE created_at < now() - interval '30 days';
ROLLBACK;
```

What to look for, in order of how often it's the actual answer:

- **A `Seq Scan` on a table with far more rows removed by the filter than
  returned** - the strongest signal a useful index is missing on the
  filtered or joined column.
- **A large gap between the planner's estimated row count and the actual
  row count** at a node - this points to stale table statistics, fixed
  with `ANALYZE <table>`, not to a missing index.
- **High `Buffers: read` relative to `shared hit`** on a node - it's
  reading from disk instead of cache, which is an I/O or working-set
  problem rather than a plan-shape problem.

Once you suspect an index and add one, re-run the same `EXPLAIN ANALYZE`
and confirm the plan actually switched to using it - don't assume it did
because the query "feels" faster. Under a small local/seeded dataset the
planner will often correctly choose a sequential scan even with the index
present, because the table is genuinely too small to benefit; validate
against a realistic row count, not the smallest dataset that happens to
exist locally.

To find which queries are worth this treatment in the first place rather
than guessing, `pg_stat_statements` ranks real production query cost - see
`postgresql.org/docs/current/pgstatstatements.html`.

→ Full `EXPLAIN` reference: `postgresql.org/docs/current/sql-explain.html`.

## "Too many connections" / a hung, exhausted pool

This is a serverless-environment problem far more often than a Drizzle
problem, and the fix depends on correctly identifying which one it is.

**Root cause, usually**: every invocation of a serverless function
(a Next.js route handler or server action running on a serverless
runtime) can open a fresh database connection. Postgres has a hard
`max_connections` ceiling; under concurrent load, invocations exhaust it
faster than connections are released.

**Diagnose**: check whether the connection pool/client is being created
fresh inside the request handler (wrong - a new pool per invocation) versus
created once at module scope and reused across invocations in the same
warm instance (right, but still limited by how many separate instances can
spin up concurrently).

```
// Bad - a new pool every invocation, on every warm start
export async function POST(req: Request) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  // ...
}
```

```
// Better - one pool per warm instance, reused across invocations
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
globalForDb.pool = pool;
export const db = drizzle(pool);
```

That alone doesn't remove the ceiling, though - it just stops making it
worse. The actual fix at scale is a connection pooler between your
application and Postgres (PgBouncer, or your provider's managed
equivalent - Supabase's Supavisor, Neon's built-in pooler), which
multiplexes many client connections onto a smaller number of real Postgres
backend connections, or a serverless-native driver that talks to Postgres
over HTTP/WebSocket instead of holding a TCP connection open per
invocation at all. Confirm which one your provider expects before adding a
pooler that duplicates one it already runs.

## Lock waits and deadlocks

If a request hangs rather than erroring, check for a blocked lock before
assuming an application-level bug:

```
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
 AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
 AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
 AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
WHERE NOT blocked_locks.granted;
```

This tells you which backend is holding the lock the stuck query is
waiting on - usually a transaction left open by another request path that
never committed or rolled back. The fix is almost always closing that
transaction path properly (a missing `COMMIT`/`ROLLBACK` on an error
branch, or a transaction held open across an unrelated slow network call),
not a change to the query that appears to be hanging.
