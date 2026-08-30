# Migration Strategy

## Approach

Build the replacement beside the current renderer, reimplement complete
journey slices against approved product and replacement-architecture contracts,
switch the production entry after those contracts are proven, and then delete
the legacy tree. This is a greenfield replacement with a controlled cutover,
not a permanent dual frontend or an implementation-parity exercise.

```text
legacy web-src ────────────────┐
                              ├─ selectable build/test entry ─→ Electron/server
replacement web-next ─────────┘
                    │
                    └─ journey slices satisfy approved contracts one at a time
```

The selector must be explicit, deterministic, local to build/test plumbing,
and absent from product state. It must not create two server APIs, preference
formats, or Electron protocols.

One window always runs one complete renderer entry. The replacement does not
embed legacy components, CSS, stores, or bundles; unfinished capabilities use
explicit development gates rather than cross-renderer composition.

After `web-next` is scaffolded, canonical typecheck and architecture commands
always include both trees. Dedicated legacy/next lint, build, and renderer-test
commands remain for diagnosis; canonical lint runs both, while canonical build
produces the selected production renderer and verifies the replacement during
coexistence. Storybook builds in CI but is never packaged. Cutover changes the
canonical production target rather than renaming the evidence suite.

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

Do not import implementation modules from `web-src/` into `web-next/`. Reuse a
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
6. Implement the smallest end-to-end usable slice in `web-next/`.
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

Keep commits independently reviewable. A typical sequence is:

```text
chore(toolchain): migrate repository tasks to pinned Vite+
style: establish the Oxfmt formatting baseline
docs(frontend): define migration architecture and gates
feat(frontend-next): establish bootstrap and platform adapters
feat(frontend-next): migrate workspace journey
feat(frontend-next): migrate document workbench
feat(frontend-next): migrate search and preparation
feat(frontend-next): migrate agent journeys
refactor(frontend): switch production renderer entry
refactor(frontend): remove legacy renderer
```

This is illustrative grouping, not a release schedule. Leave work uncommitted
until the maintainer requests commits.

The Vite+ change precedes `web-next` scaffolding and proves the unchanged
Shipping application. Existing `pnpm` scripts stay as stable wrappers. Once
accepted, no permanent Vite/Vite+ selector remains; rollback reverts that
focused change.

## Cutover

Cutover is one focused change that:

- makes the replacement the only production renderer entry;
- keeps a short-lived, explicit rollback commit available;
- updates build, lint, typecheck, chunk, and test paths;
- reconciles all current design and review documentation;
- runs the complete cutover gate; and
- does not yet delete evidence needed to diagnose the switch.

After the cutover commit is accepted, remove the legacy renderer and selector
in a separate focused change. Do not keep a dormant legacy build indefinitely.

## Rollback

Before legacy deletion, rollback means reverting the production-entry cutover,
not synchronizing user state between two independently evolving products. No
migration slice may introduce a persisted format the legacy renderer cannot
safely ignore or read unless that cross-version behavior is explicitly
designed and tested.

Until the rollback point expires, every replacement persistence write is
legacy-readable, safely ignorable, or covered by an approved forward/backward
migration. No user or remote runtime flag selects the renderer. Rollback
reverts the focused production-entry commit rather than synchronizing two live
frontend implementations.

After legacy deletion, normal version-control reversion and the release update
process own recovery. The application must never select a renderer dynamically
from user data or a remote flag.
