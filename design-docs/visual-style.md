# Visual Style

StashBase is a quiet IDE for writing: a place to enter a project, discuss an
idea, write, and refine. It combines workbench navigation with the reading
comfort needed for conversation and prose. Brainstorming is a complete working
state, including in an empty project; the interface should not imply that a
wiki or finished document is required.

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
  the interaction accent, Agent work provenance, and the brand mark are all
  neutral ink and gray. Chromatic color is confined to roles that carry
  meaning: error and destruction, Agent decisions, diff evidence, the focus
  indicator, and badge labels. Those hues are fixed, because a badge's color
  is a label rather than a surface. A new hue needs an approved direction,
  not a preference.
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
- Chat leads before a document is open. Once the user opens writing or a
  reference, document and conversation surfaces support the same work. Chat
  keeps a consistent canvas whether expanded or docked.
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

- One geometry ships, and it is rounded. There is no squared alternative to
  opt into.
- A corner is two decisions, and the product makes both the same way
  everywhere. How big it is comes from the size of the box it belongs to; how
  full it is comes from one curve the whole application draws.
- Radius belongs to the box, not to the rank. A card is the largest corner in
  the product, a row or a control a middling one, a small chip the smallest,
  and a surface does not earn a rounder corner by mattering more. The steps
  are a short published ladder rather than a number chosen per surface, so two
  boxes of the same size are never a few pixels apart, and enlarging one step
  moves every surface on it.
- Corners are continuous rather than circular. A plain arc leaves the edge
  early and cuts across the corner, which reads thinner the larger the radius
  gets; the curve this product draws eases into the edge and keeps the corner
  full, so a generous radius reads generous instead of scooped.
- A radius never reaches half of the box it is on. That is the line between a
  rounded box and a capsule, and crossing it turns a short control into a
  shape that means something else. Where the two collide the box wins and the
  corner gives way.
- Circles and capsules are reserved for semantics that need them: a status
  dot, an avatar, a switch, a badge, or a terminal action such as the
  composer's send. They stay true circles rather than taking the continuous
  curve, so the one shape that means something is never approximated. A box
  never becomes a capsule by being short. If the shape appears, it was
  chosen.
- Density is a small preset ladder rather than free-form scaling, and a region
  may be pinned to the compact step inside a roomier surface.
- Which step a control sits on follows what it belongs to. The workspace
  titlebar's own row sits on the default step. The whole sidebar, its
  titlebar band included, and everything inside a pane or a panel, sits on
  the compact step: the band's toggle and arrows are the compact square, the
  size of every glyph beneath them, and the workspace titlebar's mirrored
  trigger, arrows, and Chat toggle keep that same square so a corner never
  changes size with the sidebar's state; a 28px row with a 13px label and a 14px
  glyph, a row about twice its type, the density a chat client's sidebar
  keeps. The sidebar is one list on that one row: New chat, the Files,
  outline, and Chats rows, and the footer, with the folder header one step
  taller at 32px, the way a chat client's sidebar keeps one row for its
  every entry, so the primary action is told by its place and its plus and
  never by its size. A pane's header row and its actions, the sidebar's mode
  switch and navigator strip, the search field, the Markdown mode switch,
  and every popover sit on the same step. Switching what a panel lists never
  changes the size of a row. Three things stand at the sidebar's
  standard row instead: the folder row at the column's head, the footer's
  Gallery and account rows, and the document tab strip, which belongs to the
  titlebar.
- A control that is only a glyph is a square of its step, with the step's
  glyph inside; a labelled control takes the step's height and its own
  padding. A control's glyph rests muted at the lighter stroke and turns to
  ink at the heavier one when it is selected, hovered, or active, and a
  selected label changes tint, never weight. A sidebar row is the exception
  a chat client's sidebar taught: label and glyph both rest in ink, and
  hover and selection add the row tint and nothing else, so a row never
  changes colour, stroke, or weight under the pointer; grey stays the mark
  of a section label, a caption, or a glyph that stands alone as a button. Brand marks keep
  their own strokes and colours.
- One hover tint and one interaction shape serve every pill, whether a
  button, a tab, a row, or a popover row. A fill is never squarer, rounder,
  or darker because of which primitive drew it.
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

These are maintenance and validation limitations of implemented surfaces, not
additional unimplemented product features. Document-specific diff remains a
separate unfinished experience; existing diff colors do not establish it.

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
