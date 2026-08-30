# Subphase 0 — Toolchain and Enforcement

## 01 — Pin Vite+ and its resolved tool inventory

**Blocked by:** None.

**Status:** Complete.

Vite+ 0.3.0 is exact and lockfile-pinned. pnpm aliases Vite to the matching
Vite+ core and pins Vitest to the selected release, while the committed
inventory records bundled and compiled tools, task runner, and engines.
`pnpm test:toolchain` compares the complete local inventory after removing only
its machine-specific installation path.

## 02 — Scaffold the isolated replacement frontend

**Blocked by:** 01.

**Status:** Complete.

Create `renderer` as an independently buildable workspace package with strict
TypeScript, React, Vite+, Vitest, Oxlint, Oxfmt, deterministic browser-test
configuration, Oxlint-enforced kebab-case source names, and stable frontend
commands. A repository check rejects any `renderer` reference to the inert
`web-src` tree. Stable production commands now target only the replacement.

Evidence: `pnpm format:web`, `pnpm lint:web`, `pnpm test:renderer`,
`pnpm typecheck:web`, and `pnpm build:web`.

## 03 — Run Vite+ through CI and package-input checks

**Blocked by:** 02.

**Status:** Complete.

Every CI and release job that builds the renderer uses Vite+ 0.3.0 through the
same setup Action commit while leaving Node, pnpm installation, and the pnpm
store cache under their existing owners. Vite+ task-result caching is disabled
repository-wide. The three-platform source job verifies the resolved inventory
and runs the isolated format, lint, test, typecheck, build, boundary, and
package-input gates before the broader application matrix. Packaging evidence
proves the supported `renderer` workspace writes the only renderer input at
`dist/renderer`; inert `web-src` is not an input.

Evidence: `pnpm test:toolchain`, `pnpm test:package-inputs`,
`pnpm format:web`, `pnpm lint:web`, `pnpm test:renderer`,
`pnpm typecheck:web`, and `pnpm build:web`.

## 04 — Retired: legacy application proof

**Blocked by:** None.

**Status:** Retired by the approved single-PR replacement strategy.

The migration does not move, reformat, or prove the legacy renderer under
Vite+. Product contracts and Shipping evidence still inform replacement slices.

## 05 — Retired: repository Oxfmt baseline

**Blocked by:** None.

**Status:** Retired by the approved single-PR replacement strategy.

Oxfmt applies to `renderer` from its creation. Legacy and unrelated repository
files receive no formatting baseline.

## 06 — Folded into the isolated replacement scaffold

**Blocked by:** 02.

**Status:** Complete through 02.

The replacement browser entry, strict TypeScript, Vitest, and deterministic
browser-test setup now land together as the first replacement task.

## 07 — Enforce replacement dependency boundaries

**Blocked by:** 02.

Add dependency, lint, and repository checks that reject layer inversion,
sibling-feature access, deep imports, cycles, and unvalidated platform access.

## 08 — Establish shared Zod protocol contracts

**Blocked by:** 02.

Prove one real request, success, and classified-failure protocol from producer
through runtime validation and adapter mapping, including compatibility fixtures.
