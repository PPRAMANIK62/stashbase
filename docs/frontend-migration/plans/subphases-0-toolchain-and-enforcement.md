# Subphase 0 — Toolchain and Enforcement

## 01 — Pin Vite+ and its resolved tool inventory

**Blocked by:** None.

**Status:** Complete.

Vite+ 0.3.0 is exact and lockfile-pinned. pnpm overrides align direct Vite,
Rolldown, and Vitest resolution with the selected release, while the committed
inventory also records Vite+'s bundled and compiled formatter, task-runner, and
engine versions. `pnpm test:toolchain` compares the complete local inventory
after removing only its machine-specific installation path. The unchanged
legacy lint command remains on exact Oxlint 1.78.0 until task 02 moves and
reconciles that command with Vite+'s pinned Oxlint 1.79.0.

## 02 — Move existing frontend commands onto Vite+ tasks

**Blocked by:** 01.

Keep stable `pnpm` commands while routing unchanged legacy lint, test, and build
work through the pinned Vite+ task graph.

## 03 — Run Vite+ through CI and package-input checks

**Blocked by:** 02.

Pin CI installation, verify the resolved inventory, declare safe cache policy,
and prove packaging consumes the same intended inputs.

## 04 — Prove the unchanged application under Vite+

**Blocked by:** 03.

Run legacy build, focused unit suites, Electron smoke, and representative E2E
evidence so toolchain regressions have a clean rollback point.

## 05 — Apply the isolated Oxfmt baseline

**Blocked by:** 04.

Land mechanical formatting separately, with reviewed exclusions for generated,
vendored, fixture, snapshot, and intentionally literal files.

## 06 — Scaffold the replacement browser entry

**Blocked by:** 04.

Create an independently buildable and testable replacement entry with strict
TypeScript, Vitest, and deterministic browser-test setup.

## 07 — Enforce replacement dependency boundaries

**Blocked by:** 06.

Add dependency, lint, and repository checks that reject layer inversion,
sibling-feature access, deep imports, cycles, and unvalidated platform access.

## 08 — Establish shared Zod protocol contracts

**Blocked by:** 06.

Prove one real request, success, and classified-failure protocol from producer
through runtime validation and adapter mapping, including compatibility fixtures.
