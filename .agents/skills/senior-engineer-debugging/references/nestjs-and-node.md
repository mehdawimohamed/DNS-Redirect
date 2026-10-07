# NestJS and Node backend

## "Nest can't resolve dependencies of the X (?)"

This is the most common NestJS error and it's precise about what's wrong,
but only if you read the whole message. It names the provider that failed
to construct, the position of the missing argument, and the module context
it was looking in.

Work through it in this order rather than guessing:

1. Is the missing dependency actually in that module's `providers` array?
   The single most common cause is a provider that's used but never
   declared there.
2. Is it in the module's `imports` array instead of `providers`? A
   provider placed in `imports` produces this same error, with the
   provider's own name showing up where the module name should be - an
   easy misread if you're skimming.
3. If the dependency comes from another module, is that module actually
   imported, and does it `export` the provider (not just declare it)? A
   provider that exists but isn't exported is invisible outside its own
   module.
4. Is the same provider declared in two different modules (a feature
   module and the root module)? Nest will try to instantiate it twice;
   consolidate to one, usually with the feature module exporting it up.

→ Official reference: `docs.nestjs.com/faq/common-errors`. NestJS Devtools
(`docs.nestjs.com/devtools/overview`) can render the actual dependency
graph, which turns this from "read the error carefully" into "look at the
graph" for anything non-trivial.

## Circular dependency errors

Two providers (or two modules) depending on each other directly or
transitively. Nest cannot construct either one first.

**Diagnose before reaching for `forwardRef`**: circular dependencies are
frequently a sign the two things shouldn't be coupled the way they are.
Before wrapping the reference, check whether the shared behavior belongs
in a third provider that both depend on instead, which removes the cycle
entirely rather than working around it.

If the coupling is genuinely necessary (e.g. two services that
legitimately need to call each other), break the cycle explicitly:

```
// service-a.ts
@Injectable()
export class ServiceA {
  constructor(
    @Inject(forwardRef(() => ServiceB))
    private readonly serviceB: ServiceB,
  ) {}
}
```

and wrap the corresponding module-level import with `forwardRef(() =>
ModuleB)` as well - fixing only the provider side while the module import
is still circular will produce the same error one layer up.

## Async errors that go missing

A provider method that returns a rejected promise without the caller
awaiting or catching it fails silently from the caller's point of view -
no exception filter runs, no response reflects it, and the failure often
only shows up as a symptom somewhere unrelated (a record that was supposed
to be written but wasn't). Before assuming a bug is in the code that reads
a value, check whether the code that was supposed to write it actually
completed - an unawaited async call in a provider or a lifecycle hook is a
common place for that gap.

A global catch-all exception filter is the tool for surfacing what a
request-scoped bug would otherwise hide:

```
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    this.logger.error(
      exception instanceof Error ? exception.stack : exception,
    );
    response.status(500).json({ statusCode: 500, message: 'Internal error' });
  }
}
```

→ `docs.nestjs.com/exception-filters` for the full mechanism, including
scoping a filter globally with `APP_FILTER` so nothing slips past it
un-logged. `docs.nestjs.com/techniques/logger` covers the built-in
`Logger` and how to attach context (e.g. a request ID) so a single log
line can be traced back to the request that caused it.

## Guard / interceptor / pipe ordering

These run in a fixed order (middleware, then guards, then interceptors
around the handler, then pipes on the arguments, then the handler itself).
A bug that looks like "the wrong error code comes back" - a 500 where you
expected a 403, or a validation error that never runs because a guard
already rejected the request - is often an ordering assumption, not a
logic bug in any single guard or pipe. Before changing the logic inside a
guard, confirm what's actually running before it by checking what's
registered globally (`APP_GUARD`, `APP_INTERCEPTOR`, `APP_PIPE`) versus
per-controller, since a global registration can pre-empt a controller-level
one you're staring at.

## Module wiring vs. runtime behavior

If a provider behaves differently than its code suggests it should (e.g.
values that seem cached when they shouldn't be, or a "singleton" that
seems to have per-request state), check the provider's scope
(`DEFAULT` / singleton, `REQUEST`, or `TRANSIENT`). A `REQUEST`-scoped
provider injected into a singleton-scoped one, or state held on a
default-scoped provider that was implicitly assumed to be per-request,
produces exactly this kind of confusing, hard-to-reproduce-locally bug.
