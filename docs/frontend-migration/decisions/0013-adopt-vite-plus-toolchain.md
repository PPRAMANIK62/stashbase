---
status: accepted
---

# Adopt Vite+ as the replacement frontend toolchain

The replacement will use an exact pinned Vite+ release from its first frontend
foundation, using bundled Vite/Rolldown and aligned Vitest, Oxlint, formatting,
and task orchestration while retaining pnpm and its lockfile as the
package-management authority. Repository-level resolution aliases keep direct
Vite and Vitest consumers aligned, but migration tasks do not retool or prove
the legacy renderer.
Repository-specific architecture, docs, native, E2E, packaging, and release
gates remain explicit.
This accepts Vite+'s beta maturity and broader migration cost in exchange for a
single aligned toolchain, with pinned upgrades and complete regression evidence
containing that risk.
