# Frontend Migration

Status: **Proposed**. This documentation describes how to replace the renderer;
it does not describe Shipping behavior. The existing `web-src/` code and the
contracts under `code-review/` remain authoritative until a slice is cut over
and its documentation and evidence are updated in the same change.

## Purpose

Rebuild the complete frontend system under a new, mechanically enforced
architecture and land it only when the replacement proves the approved product
contracts. The old implementation remains under `web-src/` as inert reference
material, not a supported build or validation target. This is a
reimplementation, not a refactor or a source-compatible port. Legacy code is
read-only evidence for discovering Shipping behavior; its structure,
dependencies, state model, tooling, and allocation of responsibilities are not
constraints on the replacement.

The rewrite preserves approved product outcomes and trust requirements. It may
redesign renderer, preload, shared wire, persistence, Electron, and server API
Interfaces when the existing boundary would compromise the target
architecture. Such changes require an approved decision and coordinated
contract, compatibility, implementation, and evidence updates.

The branch retains `web-src/` only while behavior is being discovered, but no
migration task imports it, builds it, tests it, reformats it, or moves its
commands onto the replacement toolchain. `renderer/` owns the stable frontend
commands, production output, and release-blocking evidence from its initial
scaffold.

## Agent Execution Route

Work one **frontier task** at a time: choose a numbered task whose blockers are
complete from [Implementation Subphases](plans/subphases-README.md). Keep the
task as one focused change and leave later tasks out of its implementation.

Before code:

1. Read the task, this README, [Target Architecture](architecture.md),
   [Engineering Standards](standards/engineering.md), and
   [Testing and Evidence](standards/testing-and-evidence.md).
2. Assess the affected [Capability Ledger](plans/capability-ledger.md) row and
   classify discovered Shipping behavior as Retain, Change, Remove, or
   Unresolved.
3. Follow the repository documentation route to the owning product Area,
   Journey, and smallest set of review Contracts. Read only the migration
   decisions that govern the task's Seams.
4. Resolve every new product, trust, persisted-data, cross-process Interface,
   or durable architecture decision before implementation.

Implement a **tracer bullet** through the real owners and stable Interfaces.
Legacy code supplies behavioral evidence, never structure to import or copy.
When the target architecture requires a server, preload, Electron, shared
protocol, or persistence change, include that vertical change or mark the task
Blocked; a renderer workaround is not task completion.

While working, run the smallest focused evidence that exercises each changed
contract. Update the capability ledger, affected product and review docs, and
exact evidence in the same change. Use the repository pre-commit matrix only at
the pre-commit gate rather than after every edit.

Stop and surface a decision when:

- a listed blocker is incomplete;
- implementation needs an unplanned Seam or compatibility behavior;
- a rule would require a suppression, exception, or weakened gate;
- Shipping behavior cannot yet be classified; or
- trust, privacy, destructive behavior, credentials, or source durability would
  change without approval.

A task is complete only when its end-to-end outcome works through the real
Interface, focused evidence passes, architecture gates pass, documentation and
ledger status are current, compatibility and deletion conditions are explicit,
and no Required behavior is hidden behind a passing broad command.

## Document Map

- [Target Architecture](architecture.md) defines the proposed dependency
  model, runtime boundaries, state ownership, and composition rules.
- [Engineering Standards](standards/engineering.md) defines the rules new
  frontend code must satisfy.
- [Testing and Evidence](standards/testing-and-evidence.md) defines behavioral
  discovery, replacement proof, and validation expectations.
- [Migration Strategy](plans/migration-strategy.md) defines inert legacy
  reference material, replacement validation, and the one-PR landing gate.
- [Delivery Phases](plans/delivery-phases.md) orders the journey slices and
  gives their exit criteria.
- [Implementation Subphases](plans/subphases-README.md) breaks those phases
  into small dependency-linked tasks suitable for one focused implementation
  context each.
- [Capability Ledger](plans/capability-ledger.md) is the live progress record
  for journey ownership and evidence.
- [Decision 0001](decisions/0001-greenfield-frontend-reimplementation.md)
  records why this is a contract-led greenfield reimplementation rather than a
  legacy-parity port.
- [Decision 0002](decisions/0002-feature-runtime-and-protocol-ownership.md)
  records feature isolation, runtime lifetime, port ownership, and executable
  wire-contract rules.
- [Decision 0003](decisions/0003-frontend-foundation-libraries-and-enforcement.md)
  records the feature map, state and query tools, schema library, and CI
  architecture enforcement.
- [Decision 0004](decisions/0004-runtime-scope-shared-identities-and-navigation.md)
  records runtime and cache lifetimes, shared identities, protocol placement,
  navigation, and cross-feature failure vocabulary.
- [Decision 0005](decisions/0005-responsive-electron-runtime.md) records staged
  startup, process work allocation, continuity-first loading, safe optimistic
  updates, and measured performance gates.
- [Decision 0006](decisions/0006-rendering-and-resource-discipline.md) records
  subscription granularity, Suspense and virtualization policy, bounded heavy
  resources, motion, and privacy-safe performance diagnostics.
- [Decision 0007](decisions/0007-failure-recovery-and-test-foundation.md)
  records failure containment, crash-recovery direction, reconnect behavior,
  and the replacement test foundation.
- [Decision 0008](decisions/0008-token-first-component-system.md) records the
  Base UI-backed shadcn layer, token hierarchy, Tailwind enforcement, Storybook
  coverage, and product-specific visual foundation.
- [Decision 0009](decisions/0009-token-runtime-and-desktop-composition.md)
  records canonical CSS tokens, typed primitive variants, container-based
  responsiveness, visual approval, typography, and crash-journal ownership.
- [Decision 0010](decisions/0010-sandboxed-renderer-and-isolated-build.md)
  records renderer sandboxing, custom production origin, preload and IPC
  authorization, CSP, build isolation, and dependency governance.
- [Decision 0011](decisions/0011-accessible-shell-forms-and-notifications.md)
  records accessibility, pre-paint appearance, forms, Sonner notification
  ownership, and rollback compatibility.
- [Decision 0012](decisions/0012-persistence-commands-and-contract-evidence.md)
  records explicit session persistence, multi-window reconciliation, keyboard
  command ownership, replacement gates, protocol evidence, and ledger fields.
- [Decision 0013](decisions/0013-adopt-vite-plus-toolchain.md) records the
  pinned Vite+ toolchain adopted by the replacement frontend.
- [Decision 0014](decisions/0014-vite-plus-rollout-and-task-policy.md) records
  the replacement-only rollout, stable command interface, formatting and
  cache policy, pinned installation, and rollback.

## Authority

These documents define mandatory architecture for the replacement. Resolve
conflicts in this order:

1. Shipping code is the truth about current implementation.
2. `design-docs/` owns product intent and observable behavior.
3. Approved trust, privacy, data ownership, and destructive-behavior
   requirements constrain every replacement design.
4. This directory owns replacement architecture, migration decisions, and
   temporary transition state.
5. `code-review/` owns current engineering contracts and evidence routes until
   an approved rewrite decision replaces an Interface or invariant; that
   decision and the affected permanent contracts change together.

Legacy implementation patterns and current engineering Interfaces do not gain
authority merely because they already exist. Conversely, the rewrite does not
silently discard product behavior or trust requirements: intentional changes
must be named, approved, documented, and proven.

Update the affected product area, journey, review contract, and Journey
Coverage when a migrated slice changes Shipping behavior. Remove this
directory after the legacy renderer is deleted and all durable decisions have
been incorporated into their permanent owners.

## Success Criteria

The rebuild is complete only when:

- every J01–J11 renderer responsibility is implemented or explicitly proven
  to remain outside the renderer;
- every crossed contract has focused evidence against the new implementation;
- the existing release-blocking Electron and Playwright journeys run against
  the new production entry;
- accessibility, visual composition, startup, and chunk budgets are accepted;
- no supported command, production import, build entry, or evidence path
  references the legacy renderer;
- `web-src/` is clearly inert reference material rather than a supported
  implementation; and
- current architecture and evidence docs describe the replacement as Shipping.

Framework novelty, file-count reduction, and line-count reduction are not
success criteria by themselves.
