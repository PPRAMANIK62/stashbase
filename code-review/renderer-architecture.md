# Renderer Architecture

Implementation contract for how renderer modules may depend on each other.
Styling mechanics live in [Renderer Styling](renderer-styling.md); workspace
state transitions live in [Renderer Workspace](renderer-workspace.md). This
file records only the module graph.

## Layer model

Four layers under `web-src/src/`, strictly ordered. A module may import from
its own layer and from every layer below it, never above.

1. **`common/`** — the feature-agnostic leaf: pure helpers, contract types,
   presentational components, Base UI primitives, the HTTP client, and the
   cross-feature event triggers. It imports nothing but `common/` and
   `shared/`. It may not import `store/` — `store/` already imports `common/`,
   so that direction is a cycle, and a store-connected module belongs a layer
   up.
2. **`store/`** — the single `useReducer` over one `State`, its four sliced
   contexts, the action hooks, and the pure domain logic those actions apply
   (`store/lib/`). It imports `common/` only.
3. **`features/<area>/`** — one product area: `account`, `agent-panel`,
   `documents`, `preparation`, `search`, `settings`, `workspace`. A feature
   imports `common/`, `store/`, and its own subtree. **A feature never imports
   another feature** — not a component, not a type, not a trigger function,
   and not through a dynamic `import()`.
4. **`app/`** — the composition root: `App.tsx`, the global shell overlays,
   the surfaces that wire several features into one layout (`MainPane`,
   `Sidebar`), and the shell-wide keyboard and titlebar controls. This is the
   only layer allowed to import from multiple features, because composing
   them is what it exists to do.

## Where shared code goes

When a second feature needs something a first one owns, promote it rather
than importing sideways:

- Pure logic, contract types, or a presentational component → `common/`.
- State-shaped domain logic, or anything reading `State` / dispatching →
  `store/` (a `store/lib/` module, or a new action on `AppActions`).
- Rendering several features together → `app/`.

A module that is store-connected cannot go in `common/`. Split it instead:
the presentational half in `common/`, the rule that feeds it as a
`store/hooks/` hook. `SemanticIndexingNotice` is the worked example — one
view, one `useSemanticIndexingNotice`, so the Files panel and the search
popup cannot disagree about when the notice is due.

## Cross-feature triggers

A feature asks another feature's surface to open through a `common/lib/`
trigger module that owns the event name and its wrapper — `settingsTrigger`,
`librarySearchTrigger`, `embeddingSetupTrigger`. The component that listens
and renders stays in the feature that owns it and imports the trigger back
from `common/`. Exporting the trigger from the owning feature would still be
a cross-feature import, so it does not count as an exemption.

Some handoffs are state changes rather than events. Those become store
actions instead: `activateChatTab` opens or reuses a Chat tab for callers
outside the Agent Panel.

## Enforcement

`.oxlintrc.json` at the repo root, run by `pnpm lint:web`.

Each layer gets an `overrides` block keyed by path glob, carrying a
`no-restricted-imports` pattern set — one per layer plus one per feature,
each naming the siblings it may not reach. oxlint `overrides` do not merge
with the base config, so every block repeats its full rule.

The regexes match the raw `@/…` specifier, which is what makes them catch
`lazyWithRetry(() => import('@/features/…'))` as well as static imports. Four
violations in the original tree were dynamic imports only this rule found.

Alongside the boundary rules the config carries a baseline: `correctness` at
error, `suspicious` and `perf` at warn, over the typescript, unicorn, oxc,
react, import, and jsx-a11y plugins. Three deliberate calibrations:

- `react/react-in-jsx-scope` is off — the renderer uses the modern JSX
  transform, so the rule is a false positive here.
- `react/exhaustive-deps` is a warning. Several hooks narrow their deps on
  purpose and say why in a comment; making it an error would mean either
  suppressions scattered through those files or silently wrong deps.
- The `jsx-a11y` rules that require markup changes are warnings. They are
  real and worth addressing, but each is a UX decision rather than a
  mechanical fix, and the renderer's semantics are asserted separately in
  `common/__tests__/accessibility-semantics.test.ts`. Raising them is a
  follow-up, not a layering concern.

`**/__tests__/**` is exempt from the boundary rules: a renderer test may
import a feature component to render it realistically.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Layer roots | `web-src/src/common/`, `web-src/src/store/`, `web-src/src/features/<area>/`, `web-src/src/app/` |
| Composition root | `web-src/src/app/App.tsx`, `MainPane.tsx`, `Sidebar.tsx` |
| Cross-feature triggers | `web-src/src/common/lib/settingsTrigger.ts`, `librarySearchTrigger.ts`, `embeddingSetupTrigger.ts` |
| Boundary enforcement | `.oxlintrc.json` and the `lint:web` script |

## Validation

```bash
pnpm lint:web
pnpm typecheck
pnpm build:web
```

`pnpm build:web` also runs `scripts/check-renderer-chunks.mjs`, which holds
the initial-JS budget and the required dynamic-entry set. Moving a lazy
surface between layers changes its manifest path — update that list rather
than raising the budget.

Related contracts: [Renderer Workspace](renderer-workspace.md),
[Renderer Styling](renderer-styling.md), and [Agent Panel](agent-panel.md).
