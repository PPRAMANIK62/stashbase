# Migration Strategy

## Approach

Build the replacement in an isolated `renderer` workspace, reimplement complete
journey slices against approved product and replacement-architecture contracts,
with stable frontend commands targeting it from the initial scaffold. The old
tree remains inert reference material. This is a greenfield replacement, not a
dual frontend or an implementation-parity exercise.

```text
Supported: renderer ── journey slices satisfy contracts ─→ Electron/server
Reference: web-src ── behavior discovery only; never built or imported
```

There is no renderer selector. Stable build, dev, lint, test, typecheck,
packaging, and release evidence target `renderer` even while journey work is
incomplete. `web-src` is excluded from supported commands and test inventory.

The replacement does not embed or import legacy components, CSS, stores,
configuration, or bundles. `web-src` is read-only behavioral evidence while the
branch is developed; migration tasks do not move, reformat, lint, or modernize
it. Storybook catalogs the installed Fluid components under production styling
and providers; it is not a second design system and is never packaged with the
application.

## Compatibility Boundary

Preserve by default during migration:

- repository `shared/` wire contracts;
- server routes and Electron/preload Interfaces unless a separately reviewed
  cross-process change is necessary;
- product source identity and folder-scope rules;
- persisted settings and session compatibility;
- E2E selectors based on roles, accessible names, and durable product IDs;
- journey outcomes and meaningful recovery; and
- packaged output location expected by the server and Electron runtime.

These are compatibility defaults, not architectural vetoes. A boundary may
change when retaining it would compromise the replacement architecture, but
only through an approved decision and coordinated updates to its owners,
compatibility path, rollback, and evidence. Product outcomes and trust
requirements may change only through their existing maintainer-owned approval
route.

Do not import implementation modules from `web-src/` into `renderer/`. Reuse a
shared asset, type, or utility only after moving it to an intentional stable
owner with tests. Copying code into the replacement requires the same review as
new code, must be rewritten to satisfy the new standards, and must not carry
forward an architectural pattern merely because it already exists.

## Work Sequence for a Slice

1. Pin the issue or approved scope and affected journeys.
2. Read the owning area and smallest set of review contracts.
3. Use the legacy implementation and evidence to discover Shipping behavior;
   classify each behavior as retained, intentionally changed, or unresolved.
4. Fill the capability-ledger row with approved contracts, evidence, decisions,
   and gaps.
5. Define the feature's domain, application Interface, ports, and recovery.
6. Implement the smallest end-to-end usable slice in `renderer/`.
7. Add focused evidence while implementing.
8. Run the slice gate and the mapped journey evidence.
9. Update affected docs and mark the ledger with evidence, not confidence.
10. Review the pinned diff against product and replacement contracts.

When a correct slice requires a preload, server, wire, or persistence change,
mark the capability Blocked and design the coordinated Interface rather than
adding a frontend workaround. A temporary compatibility adapter may exist only
at the crossed boundary, with an owner, focused evidence, and deletion
condition. Legacy payloads and responsibilities never enter feature application
or domain code.

## Branch and Commit Discipline

Use a dedicated branch or isolated worktree. Preserve unrelated dirty-tree
changes. A secondary worktree running sync/index journeys must link a working
`python/.venv.nosync` or run `pnpm setup:python`; never commit the environment
or symlink.

Keep commits independently reviewable inside the single migration PR. A
typical sequence is:

```text
chore(toolchain): pin the replacement Vite+ inventory
docs(frontend): define migration architecture and gates
feat(renderer): establish bootstrap and platform adapters
feat(renderer): migrate workspace journey
feat(renderer): migrate document workbench
feat(renderer): migrate search and preparation
feat(renderer): migrate agent journeys
refactor(frontend): atomically replace the production renderer
```

This is illustrative grouping, not a release schedule. Leave work uncommitted
until the maintainer requests commits.

The Vite+ inventory precedes `renderer` scaffolding and applies to replacement
tasks. Stable frontend scripts target only the replacement from its scaffold.
Rollback reverts the complete migration or release; it does not depend on dual
toolchains.

## Cutover

Completion is one focused landing gate that:

- makes the replacement the only production renderer entry;
- updates build, lint, typecheck, chunk, and test paths;
- reconciles all current design and review documentation;
- runs the complete cutover gate; and
- retains only durable black-box evidence needed to diagnose the replacement.

The inert `web-src` directory may remain for historical behavior discovery,
but no supported code, command, CI job, package input, or evidence path may
depend on it.

## Rollback

Rollback is normal version-control reversion and the release update process,
not synchronization between independently evolving renderers. Every
replacement persistence write is backward-readable, safely ignorable, or
covered by an approved forward/backward migration so a previous release can
recover safely. The application never selects a renderer from user data, a
remote flag, or local runtime configuration.
