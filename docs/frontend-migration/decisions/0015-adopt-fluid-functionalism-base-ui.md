---
status: accepted
---

# Adopt Fluid Functionalism with Base UI exclusively

Fluid Functionalism is the replacement renderer's complete visual and
component system. StashBase no longer owns a parallel token hierarchy,
primitive set, or visual language derived from `web-src/`.
The `@fluid` shadcn registry is configured only as a source installer; stock
shadcn components are not used.

The installed source snapshot is
`mickadesign/fluid-functionalism@d2ea813ab0fcd0eca6fd42ba559fe69f71f2fa31`.
Every unique published component is present: accordion, ask-user-questions,
badge, button, dropdown, checkbox group, radio group, dialog, mobile drawer,
input copy, input group, input message, file thumbnail, chat message, subtle
tabs, switch, table, card, sidebar, slider, tabs, thinking indicator, scroll
area, select, tooltip, thinking steps, and color picker. Registry dependencies
also install the surface theme, elevation, spring, font-weight, shape, size,
icon, substrate, proximity-hover, touch-primary, and merge/split support.

Every dual-flavor component uses the Fluid Base UI registry path. The
replacement has no Radix UI package or import. Single-flavor components remain
as published when they are already Base UI-backed or primitive-independent.
Application composition mounts Fluid's shape, size, surface, icon, tooltip,
and reduced-motion providers. Inter Variable is consumed from its package;
Fluid's global theme, surface, type, focus, scrollbar, and component utility
rules are bundled with the renderer. The rounded shape variation is the only
supported geometry; the upstream pill variation is not exposed.

Installed registry files are reviewed first-party source after generation.
Necessary host adaptations must remain narrow and documented: the Card uses a
native anchor instead of Next.js Link, and FileThumbnail resolves the PDF.js
worker through Vite instead of loading remote code. Runtime registry access,
CDN scripts, and remote styles remain forbidden.

The former repository-owned token/style contract and its dedicated showcase
are removed. Storybook is restored solely as a catalog for the installed Fluid
source: one colocated typed CSF story module covers every public component,
with compound internals demonstrated through their public parent. It mounts
the production global CSS and Fluid provider stack, enables Autodocs and
accessibility reporting, and includes focused interaction plays where behavior
matters. Each component sets a bounded canvas sized to its real interaction
surface rather than presenting a full-screen product mockup. The static build
runs in source CI and is excluded from packaged app inputs. It does not own
tokens, primitives, or story-only styling. Component behavior is also proved
with focused product tests and runtime harnesses; representative visual and
accessibility evidence is added during migration finalization. Decisions 0008
and the visual-system portion of 0009 are superseded by this decision.
