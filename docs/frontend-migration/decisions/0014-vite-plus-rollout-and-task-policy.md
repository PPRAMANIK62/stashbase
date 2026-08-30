---
status: accepted
---

# Roll out Vite+ as a focused and verifiable toolchain change

Vite+ pins the repository inventory and owns the isolated replacement frontend.
Stable frontend scripts delegate to pinned `renderer` tasks from the initial
scaffold; `web-src` is not built or validated. Oxfmt applies to replacement
files from creation and never reformats the legacy renderer. Vite+ task-result
caching is disabled repository-wide; CI retains only pnpm's content-addressed
dependency store cache. CI pins the setup Action by commit, requests the exact
Vite+ version without delegating Node or installation ownership, and verifies
the resolved-tool inventory. The landed PR supports one renderer and one
frontend toolchain; rollback reverts the complete migration rather than
maintaining coexistence.
