# Renderer Architecture

Implementation contract for the supported renderer module graph. Styling
mechanics live in [Renderer Styling](renderer-styling.md); workspace state
transitions live in [Renderer Workspace](renderer-workspace.md). The complete
replacement target is owned by
[Frontend Migration Architecture](../docs/frontend-migration/architecture.md).

## Current foundation

`renderer/` is the only supported renderer workspace. Stable frontend dev,
format, lint, test, typecheck, and build commands target it. Its production
build writes `dist/renderer/`, the location served by the local server and
included by desktop packaging.

CI and release jobs that build this workspace use the same commit-pinned Vite+
setup with version 0.3.0. The repository keeps Node and dependency installation
under their existing Actions and disables Vite+ task-result caching.

`web-src/` remains in the repository only as read-only behavior reference. It
is not built, linted, tested, typechecked, packaged, or scanned by supported
renderer commands. Supported source and configuration must never import or
otherwise depend on it.

The current replacement surface is deliberately minimal: one semantic React
entry, one foundation stylesheet, and a rendered foundation marker. It does not
claim any Shipping product journey. Those capabilities remain migration work
and must follow the target dependency model before they enter `renderer`.

## Naming and isolation invariants

- JavaScript and TypeScript filenames in `renderer` are kebab-case. Oxlint's
  `unicorn/filename-case` rule is an error.
- `renderer` has its own package manifest, strict TypeScript configuration,
  Vite+ configuration, test discovery, and browser entry.
- Replacement source and configuration may not reference `web-src`.
- No renderer selector, compatibility import, legacy alias, or legacy CSS path
  is permitted.
- Shared behavior is introduced only through an intentional repository-owned
  Interface; copying a legacy module does not create one.

`scripts/check-frontend-boundaries.mjs` holds the cross-tree isolation
invariant. Its focused test proves that ordinary replacement files pass and a
legacy reference fails.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Workspace package | `renderer/package.json` |
| Browser entry | `renderer/index.html`, `renderer/src/main.tsx` |
| Foundation surface | `renderer/src/app.tsx`, `renderer/src/foundation.css` |
| Tool configuration | `renderer/vite.config.ts`, `renderer/tsconfig.json`, `.oxlintrc.json` |
| Production output | `dist/renderer/` |
| Boundary enforcement | `scripts/check-frontend-boundaries.mjs` and `scripts/check-frontend-boundaries.test.mjs` |
| Test inventory | `scripts/check-test-inventory.mjs` |
| CI setup contract | `scripts/vite-plus-ci.test.mjs` |
| Packaging input contract | `scripts/package-inputs.test.mjs` |

## Validation

```bash
pnpm format:web
pnpm lint:web
pnpm test:renderer
pnpm typecheck:web
pnpm build:web
pnpm test:toolchain
pnpm test:package-inputs
```

`pnpm lint:web`, `pnpm test:renderer`, and `pnpm build:web` also run the live
replacement-to-reference boundary check. The repository-wide `pnpm typecheck`
includes the replacement but deliberately excludes `web-src`.

Related contracts: [Renderer Workspace](renderer-workspace.md),
[Renderer Styling](renderer-styling.md), and [Agent Panel](agent-panel.md).
