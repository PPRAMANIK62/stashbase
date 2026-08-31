# Subphase 1 — Design and Electron Shell

## 09 — Replace the local design-system showcase with a Fluid catalog

**Blocked by:** 06.

**Status:** Complete.

The repository-owned design-system showcase is removed. Storybook now catalogs
the installed Fluid source only: every public component has a colocated story;
compound internals appear through their public parent; and the catalog mounts
production CSS and Fluid providers rather than a story-only surface. Its static
build is checked in CI but excluded from packaged app inputs. Product component
tests, focused runtime harnesses, and final visual evidence continue to
exercise production source.

Evidence: `pnpm test:renderer`, `pnpm typecheck:web`, `pnpm lint:web`,
`pnpm build:web`, and `pnpm build:storybook`.

## 10 — Adopt Fluid Functionalism

**Blocked by:** 09.

**Status:** Complete.

Continuous Workbench remains the product composition. Fluid Functionalism now
owns the complete visual language: surfaces, typography, density, shape,
focus, icons, motion, and component anatomy. No visual or component system is
derived from `web-src/`.

Decision: [0015](../decisions/0015-adopt-fluid-functionalism-base-ui.md).

## 11 — Install the complete Fluid Base UI registry

**Blocked by:** 10.

**Status:** Complete.

The `@fluid` registry is configured in `renderer/components.json`. Every
unique published Fluid component and its registry dependencies are installed.
Every dual-flavor component is overwritten with its Base UI path; the renderer
contains no Radix UI package or import. Fluid's Inter Variable font, global
theme and surface rules, providers, and utilities replace the former local
token/style contract.

The generated Card is adapted from Next.js Link to a native anchor. The
generated FileThumbnail bundles its PDF.js worker through Vite rather than
loading a CDN script. These are host-boundary changes, not alternate component
designs.

Evidence: `pnpm typecheck:web`, `pnpm lint:web`, `pnpm test:renderer`, and
`pnpm build:web`.

## 12 — Compose product forms and controls

**Blocked by:** 11.

Use installed Fluid buttons, inputs, selects, checkbox and radio groups,
switches, sliders, and related components in feature slices. Add focused
semantic tests for the product behavior being implemented; do not recreate a
local primitive layer.

## 13 — Compose overlays and navigation

**Blocked by:** 11.

Use installed Fluid dialogs, mobile drawers, dropdowns, tabs, tooltips, scroll
areas, sidebars, and surface context. Prove dismissal, focus return, keyboard
behavior, nested elevation, reduced motion, and compact-window behavior in the
product surfaces that consume them.

## 14 — Build the notification adapter

**Blocked by:** 13.

Expose semantic, stable-ID notifications without installing a stock shadcn
component or introducing a second visual system. Any notification surface must
compose Fluid primitives and preserve inline ownership for recovery,
permissions, and durable decisions.

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
