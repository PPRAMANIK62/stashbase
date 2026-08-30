# Subphase 1 — Design and Electron Shell

## 09 — Set up production-equivalent Storybook

**Blocked by:** 06.

**Status:** Complete.

Storybook now builds through the replacement's Vite configuration and real
Tailwind entry, imports the production global stylesheet, and mounts the same
renderer provider composition. Its bounded controls apply the
production `system`/`light`/`dark` theme and `small`/`default`/`large` interface
scale attributes. Forced colors and reduced motion remain real browser media
features in the shared stylesheet rather than story-only variants. The durable
Foundation Introduction story now demonstrates the approved visual language
through the production token and provider stack.

Evidence: `pnpm test:renderer`, `pnpm build:web`, `pnpm build:storybook`,
`pnpm test:toolchain`, and `pnpm test:package-inputs`.

## 10 — Approve the StashBase visual direction

**Blocked by:** 09.

**Status:** Complete.

Compare real shell, Workbench, Agent, overlay, theme, and narrow-window studies
and approve one StashBase-specific monochrome visual foundation. Chromatic
color requires a later approved decision if a concrete need emerges.

The approved **Continuous Workbench** direction uses graphite-and-paper tonal
planes, native interface typography, compact bordered chrome, and one
signature spatial transition: the same Agent session recomposes from the main
stage into its document-side dock. Production-backed Storybook studies covered
the Agent-first workspace, document and Agent composition, Settings, light and
dark themes, and narrow-window prioritization. Those temporary studies were
removed after approval; the durable direction lives in `frontend-design.md`.
Task 11 owns promotion of the approved values into the complete canonical
token and enforcement system.

Evidence: `pnpm typecheck:web`, `pnpm lint:web`, `pnpm test:renderer`,
`pnpm build:web`, `pnpm build:storybook`, manual Storybook interaction, and
1440×900 plus 700×760 Chromium inspection with no page errors or viewport
overflow. E2E and permanent visual evidence remain deferred by the migration
staging policy.

## 11 — Implement foundation and semantic tokens

**Blocked by:** 10.

**Status:** Complete.

The renderer is initialized as a Base UI shadcn workspace using the current
`base-nova` registry convention, a renderer-local `@/` alias,
`src/globals.css`, and the standard Tailwind v4 semantic color and radius
vocabulary. All provisional token values remain monochrome. Final StashBase
values are now grounded in the approved neutral substrate ladder. Named
surface, typography, radius, opacity, shadow-edge, elevation, easing, and
duration roles are exposed through Tailwind. `renderer/style-contract.json`
assigns every canonical CSS custom property to one foundation, semantic, or
Tailwind role, while `scripts/check-renderer-styles.mjs` rejects undeclared
tokens, unapproved declarations, raw colors and palette utilities, arbitrary
visual utilities, inline style props, component stylesheets, and unnamed
visual roles. The gate runs through renderer lint, test, and build commands.
The permanent Foundation Introduction story consumes these production roles
without duplicating their values in TypeScript.

Evidence: `pnpm test:renderer-styles`, `pnpm format:web`, `pnpm lint:web`,
`pnpm test:renderer`, `pnpm typecheck:web`, `pnpm build:web`, and
`pnpm build:storybook`.

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
