---
status: accepted
---

# Keep only called primitives and gate renderer quality in CI

Decision 0015 installed every published Fluid Functionalism component. This
decision narrows that: the renderer keeps a primitive only while product code
reaches it, directly or through another primitive. A test proves it for every
file under `components/ui`, and a primitive that loses its last caller is
deleted rather than kept for later. Seven primitives left under this rule on
2026-09-09 (accordion, ask-user-questions, checkbox group, color picker, input
copy, radio group, slider); they are re-installed from the registry when a
caller appears.

The renderer's quality is enforced by tools, not by review memory. The
owning contract during the migration is
[Renderer Architecture](../standards/renderer-architecture.md); this record
lists the rules it adds beyond Decision 0003's layering:

- Compiler: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, unused locals and parameters, implicit override,
  and switch fall-through are errors. No `as any`, `@ts-expect-error`, or
  non-null assertion is accepted; double casts are confined to the Milkdown
  find-controller seam.
- Lint denies warnings. `react/exhaustive-deps` and `react/rules-of-hooks`
  are errors — the `correctness` category carries neither, so a conditionally
  called hook lints clean without its own entry — and twelve `jsx-a11y` rules
  are errors beside them. `jsx-a11y/prefer-tag-over-role` is off: it reads an
  ARIA role on a live region or a viewer wrapper as a markup mistake, 64 of
  them, none an accessibility defect. Tests may not sleep, may not assert
  class names outside `components/ui`, and inner feature layers may not
  import wire schemas.
- Repository modules the renderer shares with the host are reached through
  `@/contracts/*`, an alias of their own so they are never read as part of
  the renderer's `@/shared/*` kernel. Each is registered in
  `renderer/renderer-architecture.json` and mapped at the host boundary —
  a feature Adapter, `platform`, or `app/dependencies.ts` — with
  `shared/file-formats` additionally allowed in the renderer's own shared
  kernel, because it is a vocabulary rather than a transport shape. The
  boundary is checked over the source text as well as in the dependency
  graph, since a Contract is usually imported for its types and the graph
  no longer holds those.
- `lib` is the installed Fluid registry as the installer emits it, with local
  kit extensions under `lib/local`; application plumbing lives under
  `shared/runtime`. Neither a component nor `lib` may import anything under
  `shared` except `shared/utils`, which is what keeps the kit installable
  without the application, and a registry test rejects any stray file at the
  `lib` root.
- Size: a source file is at most 400 lines and a test file 500; the
  allowlist only shrinks and is empty at the time of this record.
- Conventions script: colors and motion come from tokens; no `dark:`
  classes; request signals come from `useRequestSignals` and hooks and
  composition build no controller of their own; user-facing text comes from
  a failure-message module rather than a raw error message; a discarded
  rejection and a DOM selector in a test each carry the note that grants
  them; search predicates fold with `toLowerCase`; error classes derive
  from `FeatureError`; panels take typed view models; files over 150 lines
  open with a module header. A feature's user-facing wording has one home,
  `features/*/application/failure-messages.ts`, and a feature's optional
  `test-support.ts` is imported only from a `*.test.*` file. Every custom
  property in `globals.css` has a reader — a `var()` in the renderer's own
  `.ts`/`.tsx`/`.css`, or, for a token declared inside `@theme`, the Tailwind
  utility generated from it. A token read only by third-party CSS is named in
  an allowlist with the stylesheet that reads it; that list is empty.
- knip: no unused file, export, or dependency. jscpd: duplication under one
  percent at a 40-token clone floor.
- Coverage: only the pure layers carry a floor. `domain` and `application`
  keep 85 percent lines, functions, and statements and 75 percent branches.
  Every other layer except `components` is measured for the report and
  proven by behaviour,
  journey, and accessibility evidence; a test there exists for a named
  reason (a state machine, a failure ladder, a lifecycle invariant, a
  user-visible path, a fixed bug), never for a file's length. `components`
  takes no further sibling tests beyond the accessibility ones that exist.
- Accessibility: every story renders through axe in the test suite, and
  every full primitive test asserts no violations.

`pnpm check:web` runs the whole gate locally in the same order CI does: the
eleven gates architecture, size, conventions, unused, duplication, format,
lint, coverage, typecheck, build, and storybook. It runs every gate to
completion rather than stopping at the first failure, so one run reports every
gate that is red. CI runs it as its one renderer step; the Storybook build is
the eleventh gate rather than a step of its own, so the local command and the
workflow cannot drift.
