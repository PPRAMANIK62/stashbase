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

The replacement dependency model is already enforced even though the product
features have not been migrated. Dependency-cruiser owns graph direction and
cycles, Oxlint rejects layer-specific APIs and imports, and the repository
checker owns the approved feature map, feature shape, shared wire-schema
registration, and isolation from implementation trees.

The first registered wire boundary is version-one server health. Its shared
Zod schema validates producer and replacement-adapter values before the
adapter maps a smaller application-owned compatibility result. The adapter is
not yet consumed by visible bootstrap UI.

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
- Features are declared with their owning product area and expose only their
  public entry module; only app composition may consume that entry.
- Features never import siblings. Domain, application, infrastructure, UI,
  platform, and shared code follow the dependency direction in the migration
  architecture, including in test files.
- Repository wire modules must be registered before renderer code imports
  them. Registration identifies the reviewed executable-schema owner; it is
  not a validation waiver.

`pnpm check:renderer-architecture` runs the live graph and repository checks.
`pnpm test:renderer-architecture` additionally proves accepted inward imports
and negative fixtures for cycles, sibling access, deep imports, layer
inversion, direct platform APIs, undeclared features, legacy access, and
unregistered repository protocols. Tests receive the same production rules.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Workspace package | `renderer/package.json` |
| Browser entry | `renderer/index.html`, `renderer/src/main.tsx` |
| Foundation surface | `renderer/src/app.tsx`, `renderer/src/foundation.css` |
| Tool configuration | `renderer/vite.config.ts`, `renderer/tsconfig.json`, `.oxlintrc.json`, `dependency-cruiser.config.cjs` |
| Production output | `dist/renderer/` |
| Architecture declaration | `renderer/renderer-architecture.json` |
| Health protocol boundary | `shared/protocols/http/server-health.ts`, `server/routes/health.ts`, and `renderer/src/app/bootstrap/server-health-adapter.ts` |
| Boundary enforcement | `scripts/check-renderer-architecture.mjs` and `scripts/check-renderer-architecture.test.mjs` |
| Protocol evidence | `server/routes/health.test.ts` and `renderer/src/app/bootstrap/server-health-adapter.test.ts` |
| Test inventory | `scripts/check-test-inventory.mjs` |
| CI setup contract | `scripts/vite-plus-ci.test.mjs` |
| Packaging input contract | `scripts/package-inputs.test.mjs` |

## Validation

```bash
pnpm format:web
pnpm test:renderer-architecture
pnpm lint:web
pnpm test:renderer
pnpm typecheck:web
pnpm build:web
pnpm test:toolchain
pnpm test:package-inputs
```

`pnpm lint:web`, `pnpm test:renderer`, and `pnpm build:web` also run the live
architecture gate. Source CI runs its focused negative-fixture suite before
the broader application matrix. The repository-wide `pnpm typecheck` includes
the replacement but deliberately excludes `web-src`.

Related contracts: [Renderer Workspace](renderer-workspace.md),
[Renderer Styling](renderer-styling.md), and [Agent Panel](agent-panel.md).
