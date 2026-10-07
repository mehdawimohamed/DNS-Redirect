# Tailwind CSS and shadcn/ui

## First, split the question in two

"This class doesn't seem to work" is two different bugs with two different
diagnoses, and treating them as the same wastes time:

1. **Generation problem**: the CSS for that class was never produced at
   all. Check the page's actual generated stylesheet (dev server output,
   or view-source in production) for the class name. If it's not there,
   nothing about specificity or component structure matters yet - Tailwind
   never emitted it.
2. **Specificity/override problem**: the CSS exists, but something else
   wins. Check the element's *computed* style in the browser inspector,
   not just which classes are present on it - this tells you which rule
   actually applied.

Fixing a specificity problem as though it were a generation problem (or
vice versa) is a common wasted round trip - inspect which one you actually
have before changing anything.

## Generation problem: dynamic class names

By far the most common cause. Tailwind's build works by statically
scanning your source files as text for complete, literal class-name
strings - it does not evaluate JavaScript, so a class assembled at
runtime is invisible to it:

```
// Bad - Tailwind's scanner never sees a literal "text-blue-500" string,
// it sees a template literal, so this class is never generated
<div className={`text-${color}-500`}>
```

```
// Good - every possible literal class name appears in the source as-is
const colorClasses = {
  blue: 'text-blue-500',
  red: 'text-red-500',
} as const;
<div className={colorClasses[color]}>
```

This applies to any form of runtime string-building: template literals,
string concatenation, or constructing a class from separate variables.
If you're debugging a "class has no effect" report and the class name
involves a variable anywhere in its construction, check this first.

## Generation problem: a source directory isn't being scanned

Tailwind only generates CSS for files it's configured to look at. A
missing entry is invisible by default - there's no error, just absent
styles for anything only used in that directory.

**Tailwind v3** (`content` array in `tailwind.config.js`):
```
content: [
  './src/app/**/*.{ts,tsx}',
  './src/components/**/*.{ts,tsx}',   // shadcn's default component dir
  './node_modules/@your-org/ui/**/*.{ts,tsx}', // shared/external UI package
]
```

**Tailwind v4** (CSS-first configuration): sources are declared with
`@source` in the CSS entry file rather than a `content` array - if you're
on v4 and styles from a directory are missing, check for a missing
`@source` line there instead of looking for a `content` array that no
longer exists.

A shared UI package, a monorepo package, or a components directory added
after initial setup is the usual thing that's missing here.

## shadcn/ui components rendering unstyled

shadcn/ui isn't an installed package with its own compiled CSS - the
components are copied into your project and styled with your Tailwind
config and your theme's CSS variables. That means two specific things can
break it that wouldn't break a normal npm-installed library:

1. **CSS variable mismatch.** shadcn expects theme colors defined as CSS
   variables in your global stylesheet (`--background`, `--primary`,
   etc.) and mapped in `tailwind.config.js`'s `theme.extend.colors` (e.g.
   `primary: { DEFAULT: 'hsl(var(--primary))' }`). If either side is
   missing or was hand-edited independently, the mapped color resolves to
   nothing and the component silently loses its color, not errors. Check
   that both the variable definitions and the config mapping still agree.
2. **Init overwrote config you already had.** Running the shadcn CLI
   rewrites `tailwind.config.js`, which can silently drop a `plugins`
   array entry you already had (e.g. `@tailwindcss/forms`,
   `tailwindcss-animate`) if it wasn't part of shadcn's own template. If
   styling broke specifically after running `init` or an update, diff the
   config against your version control history rather than guessing at
   what changed.

## `cn()` and conflicting utility classes

shadcn components merge class names with `cn()` (typically `clsx` +
`tailwind-merge`) specifically so that two conflicting utilities - say a
default `p-4` and a caller-supplied `p-2` - resolve deterministically to
one winner instead of both existing in the DOM and depending on CSS source
order. If an override you're passing in via `className` doesn't seem to
apply:

- Confirm the component is actually threading your `className` through
  `cn()` (or equivalent merging) rather than concatenating it as a
  separate, competing class list.
- Check merge order - with `tailwind-merge`, the last conflicting class in
  the merged input wins, so a caller override needs to be merged *after*
  the component's own default, not before it.

Bypassing `cn()` entirely and hand-concatenating class strings is a common
way to reintroduce exactly the non-deterministic conflict `cn()` exists to
prevent - if you're debugging "my override sometimes doesn't apply,"
check for a spot where the merge was skipped.
