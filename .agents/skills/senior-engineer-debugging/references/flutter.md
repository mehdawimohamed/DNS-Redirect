# Flutter

## Triage a red or grey screen before reading further

A solid red screen (debug/profile mode) or grey screen (release mode)
means Flutter caught an error it couldn't recover from during rendering.
Before diagnosing the specific error, note which one you got - it tells
you whether you're looking at a debug-mode assertion with a full message,
or a release build where you'll need to check logs or a crash reporter
instead, because the on-screen detail won't be there.

→ `docs.flutter.dev/testing/common-errors` is the canonical, actively
maintained catalog this file draws its structure from - check it directly
for error text not covered below.

## `A RenderFlex overflowed by X pixels`

**What's actually happening**: a `Row` or `Column` has a child asking for
more space along the main axis than the parent is giving it, and unlike
web CSS, Flutter's layout has no default "just shrink to fit" behavior for
this case.

Diagnose the axis and the specific child before picking a fix - the error
message names both (horizontal/vertical, and the widget). Use the widget
inspector to confirm which child is actually the one without a size
constraint, rather than guessing from the code, especially when the
`Row`/`Column` has several children.

Three different fixes for three different actual causes - pick the one
that matches what's really happening, not the first one that compiles:

```
// The child should share remaining space with its siblings
Row(children: [Icon(Icons.star), Expanded(child: Text(longTitle))])
```
```
// The content should scroll instead of being constrained to one screen
SingleChildScrollView(child: Column(children: [...]))
```
```
// The text specifically should truncate rather than take more space
Text(longTitle, overflow: TextOverflow.ellipsis, maxLines: 2)
```
Reaching for `Expanded` reflexively when the real issue is that the
content should scroll (or vice versa) produces layouts that technically
stop erroring but don't look right - confirm which behavior you actually
want before picking the fix.

## `setState() called after dispose()`

**Root cause**: an async operation (a network call, a `Future.delayed`, a
stream subscription) was still pending when its widget was removed from
the tree, and its completion callback tried to call `setState` on a widget
that no longer exists.

```
// Symptom fix - stops the crash, doesn't address the leaked work
Future<void> fetchData() async {
  final result = await api.get();
  if (mounted) setState(() => data = result);
}
```

The `mounted` check is legitimate for genuinely fire-and-forget work
where discarding the result on navigation-away is the correct behavior.
But if the operation was something that should have been cancelled
outright when the widget was disposed (a stream subscription, a timer, an
in-flight request tied specifically to this screen), a `mounted` check
alone is a narrower version of the same symptom-patching problem as a
silent catch: it stops the crash but leaves the actual leaked work running
to completion for no reason. Prefer cancelling the source in `dispose()`:

```
late final StreamSubscription _sub;
@override
void dispose() {
  _sub.cancel();
  super.dispose();
}
```

Diagnose which case you're in by asking whether the pending work has any
further purpose once the widget is gone - if not, cancel it; if it
genuinely should complete regardless (e.g. a background upload), the
`mounted` guard is the correct, intentional choice, not a shortcut.

## Null check operator (`!`) failures

**The error tells you where the crash happened, not where the value
should have been set** - the `!` unwrap site is the detection point, not
the origin. Treat it as a trace-backward problem: find the code path that
was supposed to populate that value and determine why it didn't run, ran
in the wrong order, or ran with the wrong condition, rather than
immediately weakening the unwrap.

```
// Bad - moves the null further downstream instead of explaining it
final name = user!.name ?? 'Unknown';
```

This is the same category of fix as a `??`/`?.` swallow in JavaScript or
an empty catch in any language: it makes the immediate crash stop while
leaving the actual question - why was `user` null here - unanswered, and
the "Unknown" you now render may itself be a confusing downstream symptom
for whoever encounters it next.

**Instead**: trace where `user` is supposed to be set (a provider,
`FutureBuilder`, `initState`), and confirm it's set before this widget
builds - often the real fix is an explicit loading state in the widget
tree (`user == null ? LoadingIndicator() : UserView(user)`) rather than a
weaker unwrap on the same line that's crashing.

## UI not updating after state changes

Before assuming a rebuild bug, confirm the update actually reached the
state Flutter is watching:

- With `setState`, is the mutation actually happening *inside* the
  `setState` callback, or is the field mutated beforehand and `setState`
  called with an empty closure (which still triggers a rebuild, but is a
  sign the mutation and the rebuild trigger have drifted apart in the
  code and could next be edited independently by mistake)?
- With a state-management library (Provider, Riverpod, Bloc), is the
  widget actually listening to the specific piece of state that changed,
  or is it reading a snapshot once (e.g. via a one-time read instead of a
  watch/listen) and never rebuilding on subsequent changes?
- Is a `const` constructor on a widget preventing a rebuild you actually
  wanted? `const` widgets are intentionally skipped on rebuild for
  performance - a widget you expect to reflect new data every time is not
  a candidate for `const`.

## Tooling for the "look" step

Flutter DevTools' widget inspector is the fastest way to confirm a layout
or state hypothesis instead of reasoning about the widget tree from the
source alone - use it to check actual constraints for an overflow bug, or
actual rebuild frequency (the Rebuilds/Performance view) for a jank or
"why is this widget rebuilding constantly" investigation, before changing
code based on a guess about either.
