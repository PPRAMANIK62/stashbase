---
status: accepted
---

# Roll out Vite+ as a focused and verifiable toolchain change

Vite+ pins the repository inventory and owns the isolated replacement frontend.
Stable frontend scripts delegate to pinned `web-next` tasks from the initial
scaffold; `web-src` is not built or validated. Oxfmt applies to replacement
files from creation and never reformats the legacy renderer. Caching is limited
to fully declared
deterministic work and excluded from native, E2E, visual, packaging, release,
credentialed, and side-effecting tasks. CI pins installation by commit and
verifies the resolved-tool inventory. The landed PR supports one renderer and
one frontend toolchain; rollback reverts the complete migration rather than
maintaining coexistence.
