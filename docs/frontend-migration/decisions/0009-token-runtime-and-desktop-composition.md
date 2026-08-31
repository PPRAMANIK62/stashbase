---
status: accepted
---

# Use native runtime tokens and container-based desktop composition

The token and visual-system portion of this decision is superseded by Decision
0015. Container-based desktop composition and the crash-journal ownership
below remain accepted.

Canonical token values live as CSS custom properties mapped through Tailwind,
while CVA variants and slots keep primitive visuals inside the shared component
owner. Desktop panes adapt with container queries and density tokens rather
than web-page viewport assumptions. Phase 0 approves one of several
production-backed monochrome StashBase visual directions, beginning with native
system and monospace typography unless a bundled face earns its startup cost.
Chromatic color is deferred unless a later approved direction requires it. The
server-side File Transactions module owns any protected crash-recovery journal,
with Electron limited to OS key protection and implementation blocked until
the remaining trust decisions are approved.
