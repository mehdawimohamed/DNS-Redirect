# Next.js and React

## Hydration mismatches

**The error means**: the HTML React produced on the client's first render
doesn't match the HTML the server sent. React's message will usually name
the mismatched element or text - read that part specifically rather than
treating the error as generic.

Work through causes in this order, since they cover the large majority of
real cases:

1. **Something is computed differently on server vs. client at render
   time** - `Date.now()`, `Math.random()`, `new Date().toLocaleString()`,
   locale/timezone-dependent formatting. The server computes it once at
   request time; the client computes it again a moment later, and they
   disagree.
2. **A browser-only API read directly during render** -
   `localStorage.getItem(...)`, `window.innerWidth`, or similar, called in
   the component body. This doesn't exist on the server at all, so the
   server render and the first client render can never agree by
   construction.
3. **Invalid HTML nesting** - a `<div>` inside a `<p>`, or two `<p>`
   elements nested, often introduced by markdown/MDX content or a
   component composed in a way that violates HTML's own nesting rules.
   The browser silently repairs this on parse, producing a DOM shape that
   doesn't match what React expected to hydrate.
4. **A browser extension or platform behavior modifying the DOM before
   hydration** (ad blockers, password managers, iOS auto-linking phone
   numbers/dates). Confirm this by testing in a clean/incognito browser
   profile before spending time on an application-code explanation.

**Fix by matching first-render output, not by suppressing the warning**:

```
// Bad first instinct - hides the symptom, keeps the mismatch
<time dateTime="2024-01-01" suppressHydrationWarning />
```

```
// Better - defer the client-only value past the first render
const [isClient, setIsClient] = useState(false);
useEffect(() => setIsClient(true), []);
return <span>{isClient ? formatRelative(date) : date.toISOString()}</span>;
```

`suppressHydrationWarning` is a narrow, intentional escape hatch for
content that's genuinely expected to differ (a live timestamp) - reach for
it only after you've confirmed that's actually the situation, not as a
first response to any hydration warning.

→ `nextjs.org/docs/messages/react-hydration-error`.

## "You're importing a component that needs useState... mark with 'use
client'"

Read this as a boundary problem, not a per-file checklist. `"use client"`
marks the *boundary* between server and client rendering - it does not
need to be added to every component that happens to use a hook. Once a
file has the directive, every component it imports is already part of the
client bundle; adding the directive again to a child that's only ever
imported by an already-client parent is redundant, and adding it to the
*wrong* file (a deeply nested leaf instead of its entry point) is a common
reason people report "I added use client and it still doesn't work" - the
actual server-only ancestor between the two still isn't marked.

Diagnose by finding the actual root of the import chain that needs
interactivity - trace upward from the component using the hook to the
first ancestor that's a legitimate entry point for a client boundary - and
put the directive there, not at every hook usage site.

→ `nextjs.org/docs/app/building-your-application/rendering/client-components`.

## Data that looks stale or "stuck"

Before treating this as a state-management bug, rule out caching
explicitly - the App Router's fetch/route/data caching behavior means data
that "isn't updating" is very often working exactly as configured, not
broken. Check, in order:

1. Is the fetch or route configured with a `revalidate`/cache option that
   makes this exact behavior expected, rather than assuming it's always
   live?
2. Does the code path that's supposed to invalidate the cache after a
   mutation actually run, and does it target the right cache key/tag?
3. Only after both of those are confirmed as not the cause, look at
   component-level state (a `useState` that isn't being reset, a stale
   closure over an old prop) as the explanation.

Treating this as a rendering bug first, when it's actually a caching
configuration, is one of the more common ways an AI-generated fix adds
unnecessary client-side state or `useEffect` calls that only mask a
caching decision that was one config option away from being correct.

## Server actions / route handlers failing silently

Errors thrown inside a server action or route handler run on the server,
not the browser - if you're only checking the browser console, you may be
looking in the wrong place entirely. Check the server/terminal logs (or
your platform's function logs in production) before assuming nothing was
thrown. An unawaited call to a server action from client code, or a
server action that doesn't surface its thrown error back to the caller,
will fail exactly this way: the mutation silently doesn't happen, and the
UI has no idea anything went wrong.

## Tooling

For anything that needs step-through debugging rather than log lines,
Next.js supports attaching the Node inspector (VS Code or Chrome DevTools)
to the dev server for server-side code, separate from the browser
DevTools you'd use for client-side code - the two debug different
processes and need separate setup.

→ `nextjs.org/docs/app/guides/debugging`.
