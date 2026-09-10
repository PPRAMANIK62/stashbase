# Visual Style

StashBase is a quiet, professional workspace for sustained work with the
user's own files. It borrows the structure and density of a code workbench and
the reading comfort of a focused writing application. The interface frames the
work; it does not compete with it.

This document owns visual intent. Semantic tokens, primitives, CSS mechanics,
and visual validation live in
[Renderer Styling](../code-review/renderer-styling.md).

## One System

StashBase has one visual and component system, Fluid Functionalism, installed
as the product's primitive layer. There is no parallel StashBase token
hierarchy, primitive set, or visual language beside it. Local extensions are
allowed and stay local. A product surface composes an installed primitive
rather than inventing one, and the system carries only the primitives and icon
roles the product actually asks for, so nothing appears to exist merely
because something drew it once.

## Stance

- **Content first.** Documents, evidence, and Agent conversation carry the
  visual weight. Chrome stays restrained.
- **Calm over impressive.** Prefer clear hierarchy, neutral surfaces, and small
  transitions over decorative effects.
- **Durable over fashionable.** A change should still suit a daily workbench
  after visual trends move on.
- **Dense but readable.** Controls stay compact; reading surfaces keep enough
  space and line length for long-form work.

## Signature

StashBase has three stable visual voices:

- **Color:** the interface is monochrome. Surfaces, chrome, hover, selection,
  and the interaction accent are all neutral. Chromatic color is confined to
  roles that carry meaning: error and destruction, Agent work provenance and
  decisions, diff evidence, the focus indicator, badge labels, and the brand
  mark. Those hues are fixed, because a badge's color is a label rather than a
  surface. A new hue needs an approved direction, not a preference.
- **Typography:** two voices. One sans carries every surface, chrome and
  reading alike. One monospace carries paths, code, and structured data on
  every platform. Documents may carry their own typography, so a styled HTML
  file keeps its fonts.
- **Icons:** one coherent family with rounded caps and joins for product
  controls, with separate marks only for brands and the file-format glyphs,
  which keep their own sets.

Repeated elements must not multiply accent, brand color, or visual noise. File
type is carried primarily by shape and label rather than a rainbow of colors.

## Surfaces and Hierarchy

- Light mode is deliberately FLAT: its ladder is two near-white steps and then
  one paper, and hairline strokes plus shadow carry pane separation. Dark mode
  keeps a depth model where surface shifts do the separating. Each surface
  step pairs with one shadow step, so background and depth never disagree.
- Documents read as the primary content surface. Chat uses a consistent
  workbench canvas whether expanded or docked; layout changes do not recolor
  its identity.
- Shadows are reserved for transient overlays and the rare standing surface
  that needs a clear anchor. Permanent hierarchy should not depend on heavy
  elevation.
- What a floating panel is decides its background, not only how high it sits.
  A menu, popover, or select tracks the substrate it opens over, because it
  reads as part of that surface. A dialog belongs to no pane, so it keeps one
  fixed background and lets shadow carry its elevation. The same dialog must
  not read as a different panel depending on which pane opened it.
- Section hierarchy comes from spacing, alignment, and type weight rather than
  decorative header bands.

## Shape and Density

- One geometry ships, and it is rounded. Boxes share one continuous container
  shape; controls and rows use the smaller interaction shape appropriate to
  their role. Size alone does not create a new corner language, and there is
  no squared alternative to opt into.
- Circles and capsules are reserved for semantics that need them, such as
  status or a terminal action. A box never becomes a capsule by being short.
  If the shape appears, it was chosen.
- Density is a small preset ladder rather than free-form scaling, and a region
  may be pinned to the compact step inside a roomier surface.
- Desktop panes adapt to the room they are given rather than to the size of
  the window. A reading measure or a shelf layout responds to its own
  container; a viewport assumption is a fallback, not the rule.
- List hover and selection are quiet tints that glide between rows rather than
  repainting them. Accent feedback is reserved for states that must be
  unmistakable, such as an active drop target.
- Sibling controls align to shared grid lines. Empty states use one deliberate
  anchor instead of distributing unrelated decoration through unused space.

## Reading and Interaction

- A person chooses the theme, the interface size, and the reading text size in
  Settings. Interface size changes chrome only; reading text size changes
  reading surfaces only. Each is a small preset ladder, because a value is
  applied to the whole document rather than to one control.
- Reading content follows a comfortable measure; workbench chrome remains
  compact. The interface-size preference moves text and the space around it
  together, so a larger setting stays legible instead of crowding denser.
- Focus is visible without shifting layout. Hover and selection do not move
  surrounding content.
- Every control that can be pressed visibly accepts the press. A surface that
  takes a click and shows nothing leaves the user waiting on the result with
  no sign the app heard them.
- A panel that belongs to a control appears from that control. Menus,
  popovers, and tooltips grow out of what opened them; a dialog, which
  belongs to no single control, arrives in the middle.
- Motion is brief feedback, never spectacle. It is graded by what it is doing,
  whether arriving, moving, leaving, or merely tinting, rather than by which
  surface it happens on, and nothing arrives from nothing. Leaving is quicker
  than arriving, because the element is already understood. Reduced-motion
  preferences are respected on every animated surface, CSS-driven and
  script-driven alike.
- Light, dark, and system themes are equal product states. A visual change is
  incomplete if hierarchy or legibility works in only one.

## Accessibility

The product targets WCAG 2.2 AA. Every surface stays operable from the
keyboard alone, keeps its focus order and semantics, and announces the state
changes a person needs to hear. Supported interface and reading sizes,
compact layouts, and reduced motion are product states rather than degraded
ones.

## Known Gaps

- Contrast is the one accessibility property no gate holds. Keyboard order,
  focus, semantics, and roles are checked automatically across the component
  catalog in light, dark, and compact environments, but the same check cannot
  resolve computed color. Contrast is reviewed by eye and can regress without
  failing anything.
- The interface sans ships with the application but is not the face that
  renders. The interface currently falls back to the platform's system sans,
  so the intended sans reaches nobody. Neither voice carries a CJK fallback,
  which leaves CJK text to whatever the platform picks.

## Contribution Contract

A visual contribution should:

- strengthen the content-first workbench identity;
- compose the installed primitives and semantic roles instead of inventing
  one-off literals or behaviors;
- remain clear at supported interface and reading sizes, compact layouts, and
  reduced motion, and stay operable from the keyboard alone;
- change this document only when the visual language itself changes, and change
  the Renderer Styling contract when implementation mechanics or validation
  change.

Exact tokens, corner assignments, primitive ownership, and exemptions belong
only in [Renderer Styling](../code-review/renderer-styling.md).
