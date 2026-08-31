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

## 15 — Build the responsive application shell

**Blocked by:** 11.

**Status:** Complete.

Build the first product-shaped surface before broad component integration. The
initial shell is sidebar-driven: one Files sidebar controls a single Agent
workspace, with minimal titlebar chrome and working collapse, resize, keyboard,
and compact-window behavior supplied by the installed Fluid sidebar. The
collapsed rail does not hover-peek over its titlebar control; that control stays
clear and is the authoritative way to expand it.
The Files sidebar belongs to the lower application substrate; the complete
Agent workspace, including its titlebar, is one elevated inset surface above
it rather than an equal edge-to-edge pane.
Do not pre-compose a document canvas or right Agent dock. Those appear only
after a user opens a file from the Files tree, when the document becomes the
main canvas and the same Agent session moves into the conditional right dock.

The shell owns geometry and presentation state only. It does not invent file,
document, retrieval, or Agent policy, and it does not fill incomplete feature
regions with explanatory placeholder copy.

Current implementation: the replacement renderer mounts the Files rail, Agent
workspace, native drag band, and sidebar controls. Feature content, conditional
document composition, nested failure boundaries, and Electron shell evidence
remain open.

Evidence: `pnpm test:renderer`, `pnpm typecheck:web`, `pnpm lint:web`,
`pnpm build:web`, and manual wide/compact renderer checks.

## 12 — Compose product forms and controls

**Blocked by:** 15.

Use installed Fluid buttons, inputs, selects, checkbox and radio groups,
switches, sliders, and related components in feature slices. Add focused
semantic tests for the product behavior being implemented; do not recreate a
local primitive layer.

## 13 — Compose overlays and navigation

**Blocked by:** 15.

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

## 16 — Add accessibility and performance harnesses

**Blocked by:** 12, 13, 14, 15.

Measure WCAG behavior, keyboard and focus paths, startup stages, bundle entries,
long tasks, interactions, and resource disposal in repeatable environments.

## 17 — Serve packaged renderer assets through `app://`

**Blocked by:** 06.

**Status:** Complete.

The `app` scheme is registered before Electron readiness as a standard, secure,
fetch-capable origin. Normal source and packaged windows load only
`app://renderer/` assets rooted under `dist/renderer`; explicit Vite development
continues through the loopback origin. Every application-protocol response
overrides upstream policy with a CSP beginning at `default-src 'none'`,
self-hosted scripts and styles, narrow asset schemes, and only the exact
Electron-owned loopback HTTP/WebSocket endpoint for server capabilities.

Evidence: `pnpm test:electron-boundary`,
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`, and
`pnpm test:package-inputs`.

## 18 — Bundle a sandbox-compatible typed preload

**Blocked by:** 08, 17.

**Status:** Complete.

The TypeScript preload is bundled with its runtime schemas and keeps Electron
as its only sandbox-provided external. It exposes one frozen
`stashbase.workspace` capability containing only the validated folder-dialog
method. Raw IPC, Electron events, window identity, filesystem access, and
product policy do not cross the bridge. The renderer-side adapter consumes the
bridge without UI importing Electron or the global capability. The broad
legacy `window.electron` preload is retired from runtime and package inputs,
and its renderer-facing main-process handlers are removed. Its inert source
remains only to keep Shipping documentation verifiable until Task 60 retires
obsolete evidence; future capabilities are added with the feature slice that
owns them.

Evidence: `pnpm test:electron-boundary`, `pnpm test:renderer`,
`pnpm typecheck`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.

## 19 — Enforce IPC sender authorization

**Blocked by:** 18.

**Status:** Complete.

The folder-dialog handler derives its window from the IPC sender and requires a
live registered window, the sender's main frame, the configured renderer
origin, a main-owned workspace capability grant, and a valid Zod payload before
native UI can open. Replacement windows enable sandboxing, context isolation,
web security, and disable Node integration, webviews, experimental features,
and insecure content. Popups, unexpected navigation and redirects, webview
attachment, and session permissions deny by default; external URLs can leave
the application only through separately owned, explicit main-process actions.
The superseded untyped renderer handlers are removed rather than kept as a
parallel boundary. Native menu actions and independently owned services remain
main-process responsibilities.

Evidence: `pnpm test:electron-boundary`, `pnpm test:electron`,
`pnpm typecheck`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.
