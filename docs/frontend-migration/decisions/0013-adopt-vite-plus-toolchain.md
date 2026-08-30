---
status: accepted
---

# Adopt Vite+ as the repository frontend toolchain

The repository will migrate to an exact pinned Vite+ release before the
replacement frontend foundation, using its bundled Vite/Rolldown and aligned
Vitest, Oxlint, formatting, and task orchestration while retaining pnpm and its
lockfile as the package-management authority. Adoption is repository-wide
because the required resolution overrides and task graph cross legacy
renderer, replacement renderer, server, Electron, and CI boundaries.
Repository-specific architecture, docs, native, E2E, packaging, and release
gates remain explicit.
This accepts Vite+'s beta maturity and broader migration cost in exchange for a
single aligned toolchain, with pinned upgrades and complete regression evidence
containing that risk.
