# Frontend Design Direction

Status: **Continuous Workbench layout and visual foundation approved. Feature
component design remains iterative.**

## Product Idea

StashBase is one adaptive workspace for local files and Agent-assisted work. It
does not separate Chat, documents, and retrieval into different products. The
workspace changes its center of gravity according to what the user is doing:
the Agent leads before a document is open, and the document leads once the user
opens a source.

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

The shell has four stable regions:

- **Scope and command bar** — identifies the current Library or folder and
  provides global navigation and commands without becoming a separate product
  header.
- **Navigator** — keeps the ordinary local folder and file tree available as
  the primary source-navigation model.
- **Main stage** — holds either the Agent-first workspace or the active source
  document.
- **Agent dock** — appears beside an open source and preserves the Agent
  session that previously occupied the main stage.

Settings opens as one focused application modal over the workspace. It does
not replace the workspace or become another navigation destination.

## Interaction Direction

- A new workspace begins Agent-first without requiring a document to be open.
- Opening a file, citation, search result, or Agent-produced artifact places
  the visible source in the main stage.
- Opening a source changes presentation only. It does not silently add that
  source to Agent context or widen the conversation's scope.
- Closing the last document returns an open Agent session to the main stage.
- Hiding or revealing the Agent is an explicit user choice and survives later
  document navigation.
- The navigator, document stage, and Agent dock are independently resizable or
  collapsible where space permits.
- A compact window prioritizes one usable work surface instead of squeezing all
  three regions into narrow columns. The underlying document and Agent state
  remain mounted across layout changes.

## Product Boundaries

- Ordinary local files remain the visible and durable source of truth.
- Search, preparation, and Agent activity resolve back to visible sources;
  derived artifacts do not become a second file tree.
- Library and folder scope stay recognizable wherever Agent work occurs.
- Agent-created or changed files remain inspectable before the user treats them
  as accepted work.
- The shell arranges workspace regions but does not own document, retrieval,
  preparation, or Agent policy.

## Approved Visual Foundation

The selected direction is **Continuous Workbench**. It treats StashBase as a
precise desktop instrument made from a small number of joined tonal planes,
not a dashboard assembled from floating cards.

- **Material model:** the application frame and Agent use quiet graphite
  planes; the active source is the clearest paper-like plane. One-pixel seams
  explain ownership. Shadows are reserved for a raised composer, transient
  overlay, or compact-window pane that genuinely crosses another surface.
- **Monochrome palette:** the neutral substrate model follows the useful
  surface hierarchy demonstrated by
  [Fluid Functionalism](https://www.fluidfunctionalism.com/docs/surfaces),
  adapted to StashBase rather than copied as a component system. Light mode
  starts at `#fafafa`, rises through `#fcfcfc`, and flattens elevated surfaces
  to white, where seams and restrained shadows carry depth. Dark mode starts
  at graphite `#171717`, not black, then lifts through `#1e1e1e`, `#252525`,
  `#2c2c2c`, `#333333`, `#3a3a3a`, `#414141`, and `#484848`. Background,
  card, popover, dialog, and nested-menu roles select from this ladder relative
  to their substrate so nested surfaces never disappear into one another.
  Muted content, borders, hover, selection, and focus use neutral tonal
  contrast only. Fluid Functionalism's chromatic focus and status accents are
  intentionally not adopted; chromatic color remains prohibited without a
  later approved need.
- **Typography:** native system sans is the interface and reading default.
  Native monospace identifies paths, source metadata, shortcuts, status, and
  other machine-shaped information. Hierarchy comes from size, weight, and
  spacing rather than decorative display typography.
- **Density:** chrome is compact and information-rich, while document and
  conversation content receive generous reading measure and whitespace.
  Controls share a restrained height rhythm; small icon-only controls retain
  clear focus treatment and accessible names.
- **Shape and elevation:** the base corner is `0.375rem`. Containers are
  lightly rounded, active rows may use monochrome inversion, and circular
  shapes are limited to inherently circular status or identity markers.
- **Iconography:** simple neutral stroke icons support recognition without
  becoming decoration. Labels remain present where an icon alone would make a
  command ambiguous.
- **Signature:** the persistent Agent-to-dock transition is the one expressive
  spatial moment. Other motion remains subordinate to navigation, state, and
  feedback.

Task 11 established the canonical foundation-to-semantic token mapping,
Tailwind exposure, and literal/token enforcement. The values above remain
documentation only: product components consume the approved roles registered
in `renderer/style-contract.json` and never duplicate these literals.

The permanent Storybook **Foundation / Introduction / Visual language** story
is the executable reference for these relationships. Agents should consult it
before adding shared components or visual roles. It must consume production
tokens, global styling, appearance controls, and providers; story-only visual
tokens, CSS, and component forks are not acceptable substitutes.

## Still to Design

The approved direction establishes the shared visual language without freezing
every feature component. The following remain open design work:

- final feature component anatomy and interaction polish;
- responsive pane thresholds and resize behavior within the approved
  composition;
- tab, tree, composer, transcript, search, viewer, status, and Settings
  refinements as real behavior arrives;
- feature-specific motion, resize feedback, and empty, loading, failure,
  permission, and conflict states.

Future work should preserve the composition, tonal hierarchy, typography,
density, shape discipline, and adaptive transition above while refining
individual feature components.

## Motion Direction

StashBase motion follows the product principles described in Benji Taylor's
[Family Values](https://benji.org/family-values): simplicity through gradual
revelation, fluidity through seamless transitions, and delight through
selective emphasis. This is a direction for how the interface should behave,
not permission to copy Family's components or mobile interaction patterns.

### Signature Transition

The defining StashBase motion is the transition between the Agent-first and
document-first workspace compositions. When a source opens, the existing Agent
workspace moves and recomposes into the right dock while the source takes the
main stage. When the last source closes, that same Agent session returns to the
main stage.

The transcript, draft, activity, scope, scroll position, and session identity
remain continuous. The interface must not replace the Agent with a visually
similar second instance, replay an entrance animation, or imply that opening a
source changed Agent context. This transition should make the workspace's
architecture understandable without demanding attention for its own sake.

### Motion Principles

- **Reveal complexity when it becomes relevant.** Prefer a focused menu,
  popover, modal, or expanding region over presenting every command at once.
  Each transient surface should have one clear purpose and preserve the
  workspace beneath it.
- **Show the path between states.** Motion should explain where a region came
  from, where it went, or how its responsibility changed. Direction follows
  the workspace's spatial model; transitions must not contradict the visible
  layout.
- **Transform persistent elements instead of replacing them.** If an element
  and its state continue into the next composition, keep them visually and
  structurally continuous. Avoid duplicate elements crossing during a
  transition, unnecessary exit-and-reentry, and whole-surface refreshes for a
  local change.
- **Animate meaningful change, not decoration.** Motion may clarify navigation,
  hierarchy, progress, reordering, disclosure, or the result of an action. Do
  not add ambient motion merely to make the interface feel active.
- **Use delight selectively.** Frequent actions should feel quiet, immediate,
  and polished. Rare, meaningful completions may receive more expressive
  feedback when it reinforces what was accomplished. Novelty must never slow a
  repeated workflow or obscure status.
- **Polish the whole path.** Empty, loading, failure, permission, conflict, and
  recovery states follow the same spatial rules as successful states. Motion
  quality must not collapse at less common edges of a workflow.
- **Preserve trust.** File changes, Agent activity, permissions, and durable
  outcomes must never be implied by animation before they are authoritative.
  Motion communicates a known transition; it does not pretend that work has
  completed.

### Rules for Implementing Motion

Before adding an animation, an agent must be able to answer:

1. What product state changed?
2. What spatial or causal relationship does the motion explain?
3. Which elements persist, enter, leave, or transform?
4. Can the interaction be interrupted or reversed without visual or state
   corruption?
5. What immediate, understandable result remains with reduced motion enabled?

The approved motion scale is 120ms for fast feedback and exits, 180ms for
standard transient surfaces, and 240ms for the signature workspace
recomposition. Entry and exit use `cubic-bezier(0.23, 1, 0.32, 1)`; visible
spatial movement uses `cubic-bezier(0.77, 0, 0.175, 1)`. Task 11 will expose
these values as canonical semantic tokens. Feature code must not invent local
timing curves or motion values.

Prefer compositor-friendly transforms and opacity, preserve focus and mounted
feature state, and avoid animation that delays input, confirmation, or error
recovery. Reduced motion removes travel and ornamental sequencing while
preserving state changes, hierarchy, focus, and feedback.

Task 10 approval covered the Agent-to-dock transition, source opening and
closing, contextual overlay entry and focus return, pane collapse and
restoration, and narrow-window recomposition. The temporary studies were
removed after approval. Permanent E2E and visual evidence remains deferred
until migration finalization.
