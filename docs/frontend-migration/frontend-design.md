# Frontend Design Direction

Status: **Continuous Workbench composition approved. Fluid Functionalism is
the complete replacement visual and component system. Feature composition
remains iterative.**

## Product Idea

StashBase is one adaptive workspace for local files and Agent-assisted work.
It does not separate Chat, documents, and retrieval into different products.
The Agent leads before a document is open; the document leads once a source is
opened.

The defining transition is:

> Chat occupies the main stage until a file needs attention. Opening a file
> places that source in the center and moves the same Agent session to a right
> dock without losing its transcript, draft, activity, or scope.

## Workspace Composition

With no document open:

```text
┌──────────────────────────────────────────────────────────┐
│ Scope and commands                                       │
├──────────────────┬───────────────────────────────────────┤
│ Navigator        │ Agent workspace                       │
│                  │                                       │
│ Local file tree  │ Conversation and activity             │
│                  │                                       │
│                  │ Composer                              │
└──────────────────┴───────────────────────────────────────┘
```

With a document open:

```text
┌──────────────────────────────────────────────────────────┐
│ Scope and commands                                       │
├──────────────────┬──────────────────────┬─────────────────┤
│ Navigator        │ Document workspace   │ Agent dock      │
│                  │                      │                 │
│ Local file tree  │ Tabs and source      │ Same session    │
│                  │                      │ and composer    │
└──────────────────┴──────────────────────┴─────────────────┘
```

The shell owns the scope and command bar, Navigator, main stage, and Agent
dock. Settings opens as a focused modal over this workspace. Opening a source
changes presentation only; it does not widen Agent context. Compact windows
prioritize one usable work surface without discarding mounted document or
Agent state.

## Product Boundaries

- Ordinary local files remain the visible and durable source of truth.
- Search, preparation, and Agent activity resolve back to visible sources.
- Library and folder scope stay recognizable wherever Agent work occurs.
- Agent-created or changed files remain inspectable before acceptance.
- The shell arranges regions but does not own document, retrieval,
  preparation, or Agent policy.

## Adopted Visual and Component System

[Fluid Functionalism](https://www.fluidfunctionalism.com/docs) is adopted as
the renderer's visual system in full. The replacement does not derive a second
StashBase token set, primitive library, component anatomy, or visual language
from `web-src/`.

- The Fluid eight-level substrate and shadow ladder owns light and dark
  surfaces, nested elevation, borders, hover, active, selection, focus, and
  destructive roles.
- Bundled Inter Variable owns interface typography and Fluid's variable-weight
  transitions. Fluid's default/compact size ladder owns control density and
  type roles.
- Fluid's rounded shape variation owns component geometry. The renderer does
  not expose Fluid's pill variation.
- Fluid's named icon slots use Lucide defaults. Product features override a
  slot through `IconProvider` only when the product meaning requires it.
- Fluid's proximity hover, merge/split selection, spring presets, touch-primary
  behavior, scroll treatment, and substrate-relative overlays are the motion
  and interaction language.
- Interactive Fluid components use their Base UI flavor exclusively. Radix UI
  packages and component implementations are outside the replacement.
- Components are installed as source through the configured `@fluid` shadcn
  registry. The CLI is transport only; stock shadcn components are not the
  renderer component layer.
- Storybook is a component-catalog workbench for the installed Fluid source,
  not a StashBase design system. Its stories mount the production global CSS
  and provider stack and use deterministic local fixtures; it owns no tokens,
  primitives, or story-only styling. Product tests and migration visual
  evidence remain the authority for application composition.

The complete installed inventory and the approved integration policy are
recorded in
[Decision 0015](decisions/0015-adopt-fluid-functionalism-base-ui.md). The
registry is never contacted at runtime, and the bundled PDF worker adaptation
preserves the renderer's no-remote-code trust boundary.

## Motion Direction

Motion is information. Fluid's spring presets replace the former local timing
and easing scale: fast for immediate feedback, moderate for short travel and
selection, and slow for larger surfaces. All Framer Motion components run
under `MotionConfig reducedMotion="user"`.

The Agent-to-dock recomposition remains the signature product transition. It
must transform the persistent session rather than replacing it, preserve
transcript, draft, activity, scope, and scroll state, remain interruptible, and
leave an immediate understandable state under reduced motion. File changes,
permissions, Agent activity, and durable completion are never implied before
they are authoritative.

## Still to Design

The adopted system freezes the visual primitives, not every feature
composition. Responsive pane thresholds, tabs, tree, composer, transcript,
search, viewers, Settings, and empty/loading/failure/conflict states still need
product-specific assembly from Fluid components. New work extends Fluid
components only for a demonstrated StashBase behavior; it does not recreate a
parallel token or primitive system.
