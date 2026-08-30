# Subphase 1 — Design and Electron Shell

## 09 — Set up production-equivalent Storybook

**Blocked by:** 06.

Run Storybook with the replacement's real Tailwind, providers, themes, interface
scale, forced-colors behavior, and reduced-motion behavior.

## 10 — Approve the StashBase visual direction

**Blocked by:** 09.

Compare real shell, Workbench, Agent, overlay, theme, and narrow-window studies
and approve one StashBase-specific monochrome visual foundation. Chromatic
color requires a later approved decision if a concrete need emerges.

## 11 — Implement foundation and semantic tokens

**Blocked by:** 10.

Define canonical CSS tokens, expose semantic roles through Tailwind, and reject
raw visual literals and undeclared tokens.

## 12 — Build form and control primitives

**Blocked by:** 11.

Create tokenized Base UI-backed shadcn buttons, fields, selects, checkboxes,
toggles, and form anatomy with accessible Storybook states.

## 13 — Build overlay and navigation primitives

**Blocked by:** 12.

Create dialogs, menus, popovers, tooltips, tabs, portals, dismissal, focus
return, and keyboard behavior under one primitive owner.

## 14 — Build the Sonner notification adapter

**Blocked by:** 13.

Mount one root Toaster and expose semantic, stable-ID notifications through a
headless Tailwind/shadcn shell without giving features direct Sonner access.

## 15 — Build the responsive application shell

**Blocked by:** 13, 14.

Compose titlebar, sidebar, main stage, Agent docking, container-responsive
layout, and nested failure boundaries without feature policy in the shell.

## 16 — Add accessibility and performance harnesses

**Blocked by:** 15.

Measure WCAG behavior, keyboard and focus paths, startup stages, bundle entries,
long tasks, interactions, and resource disposal in repeatable environments.

## 17 — Serve packaged renderer assets through `app://`

**Blocked by:** 06.

Register the privileged production UI origin with restrictive CSP while keeping
authenticated loopback server capabilities on their own boundary.

## 18 — Bundle a sandbox-compatible typed preload

**Blocked by:** 08, 17.

Expose one capability-specific context bridge using Zod validation, explicit
subscription cleanup, and no raw IPC or product policy.

## 19 — Enforce IPC sender authorization

**Blocked by:** 18.

Validate sender window, frame, origin, capability, and payload; deny navigation,
new windows, permissions, and external URLs unless explicitly authorized.

## 20 — Launch the replacement shell in real Electron

**Blocked by:** 15, 16, 19.

Launch the selectable replacement entry with effective sandboxing, custom
origin, CSP, staged paint, fatal recovery, and Electron smoke evidence.

## 21 — Apply appearance before first React paint

**Blocked by:** 11, 20.

Apply theme, scale, density, contrast, and reduced motion from a non-secret
snapshot without waiting for the local server.

## 22 — Settle bootstrap capabilities independently

**Blocked by:** 20, 21.

Settle server health, Settings, Agent discovery, indexing, and updates behind
local loading and recovery rather than one global readiness gate.
