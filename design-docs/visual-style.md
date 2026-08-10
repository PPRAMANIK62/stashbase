# Visual Style

StashBase is a workbench people stay in for hours while their own files remain
the subject. The visual language is therefore **a quiet, professional
workspace**: structured like a code workbench, reading like a focused writing
app. The UI is the frame, never the picture. Beautification work should deepen
this identity, not replace it.

This document is the design-intent contract for UI styling. The semantic theme
tokens in the renderer stylesheet are the implementation API; component styles
consume those roles and never restate literals.

## Stance

- **Content-first.** User files, search results, and agent conversation carry
  the visual weight. Chrome stays low-contrast, low-saturation, and dense.
- **Calm over impressive.** No gradients, glassmorphism, large radii, heavy
  drop shadows, or decorative illustration. Nothing in the chrome should
  compete with a document for attention.
- **Durable over fashionable.** The style should still look right after a year
  of daily use. Prefer refinement of the existing signature to trend adoption.

## Signature

Two elements make StashBase recognizably itself; strengthen them, never dilute
them:

- **Cyan + amber color pair.** Cyan is the working accent — interactive
  emphasis, focus, progress, info — but NOT selection surfaces: selected
  rows/pills use a quiet neutral one step past hover, because accent
  washes at row width read loud. Amber is the counterpoint,
  used sparingly where the brand shows (file-type marks, the occasional
  brand moment). The pairing comes from the `.html`/`.md` file icons and is
  deliberately not the generic AI-product purple. Sparingly is a hard
  budget: at most one amber moment per screen, and never on repeated
  elements (an icon that appears once per row multiplies into a loud
  surface). A screen that already reads cyan + amber + neutral is full —
  this is a tool, and two hues is its ceiling.
- **Three-voice typography.** System sans (with CJK fallbacks) for chrome and
  controls; serif for long-form reading content — editor titles and agent
  prose; monospace for paths, code, and data. Chrome informs, serif invites
  reading, mono signals precision. Apply the voices by role, not by surface
  fashion.

## Color

- Surfaces are neutral and low-chroma in both themes. Hue lives almost
  entirely in the accent pair and the status colors.
- Status colors (info/success/warning/danger) are semantic tokens, reserved
  for state — never decoration.
- Light and dark are equal citizens. Every color decision is made as a role
  (surface, text, stroke, accent) with a value per theme; a change that only
  looks right in one theme is not done.

## Surfaces and Depth

- Three surface levels — sunken (panels, tab strip), base (content), and
  raised (cards, popovers) — establish hierarchy through background shifts.
- Documents are paper, chat is workbench canvas: document panes own the
  base surface — the app's only pure content white — while the Agent chat
  sits on its own canvas role, a cool near-white between paper and the
  sunken chrome, identical in both of its layouts (chat-primary and
  docked), floating its cards (user turns, composer, code blocks). All
  three neighbours — chrome, canvas, paper — stay mutually perceptible.
  A layout change resizes a pane; it never recolors one — surface roles
  must not depend on layout, or switching reads as a mode jump.
- Separation comes from 1px subtle strokes and surface changes, not shadows.
- Shadow is reserved for transient overlays (menus, dialogs, toasts) — the
  one elevation treatment — so floating things read as floating and nothing
  else does. One standing exception: the empty-chat hero composer carries a
  minimal raised shadow (the `raised` shadow role) so the anchor of an
  otherwise bare pane has presence; docked composers stay flat.
- Section titles live OUTSIDE their cards: hierarchy comes from type weight
  and spacing, never from a tinted header band inside the card.
- List interaction states are neutral: a light cool-gray hover that persists
  while a row anchors an open menu. No colored row bands — accent washes at
  row width read dirty at any strength, so hue stays on button-level
  elements.

## Density and Shape

- Compact workbench density: small control heights, tight gaps, small radii.
  Density is what makes the app feel like a tool rather than a landing page;
  do not relax it for visual trends.
- Radii stay small and consistent (a control radius and a slightly larger
  UI-surface radius). No pill buttons, no large-radius cards. The one
  sanctioned capsule is the transient floating affordance (the
  transcript's jump-to-latest pill); persistent chrome controls never
  render as pills.
- List hover and selection render as an inset rounded pill — a small-radius
  row surface inset from the panel edges — never a full-bleed band or an
  accent edge bar.

## Composition

- Content columns have a stated maximum width (the chat transcript and the
  empty-state column are the reference cases); text never runs a wide pane
  edge to edge.
- Every empty state names one deliberate anchor. The hero element — usually
  the composer — carries visible weight, and leftover space below it is
  closed by a single bottom-anchored muted suggestion line. Whitespace must
  read as intended, never as missing content; no wordmark or tagline does
  this work.
- Hero groups sit on the pane's optical center; a block that drifts low
  reads as unfinished.
- Siblings share one grid line: elements stacked in a hero column align
  to the same content edge; the bottom-anchored suggestion line centers
  on the pane's axis instead.

## Motion

- Motion is feedback, not spectacle: fast (roughly 100–200ms), one standard
  easing, applied to hover, selection, and pane transitions.
- Focus and hover feedback never moves layout; large surfaces never animate
  position under reduced motion.

## Warmth Budget

Empty states — such as the sidebar's zero-folder library block — are the only
places the brand is allowed a little warmth: the app mark, the single amber
moment, a touch more spacing. The serif voice stays in content surfaces (editor titles, agent
prose); chrome, including brand chrome, speaks sans so one screen never mixes
personalities. Everywhere else the chrome stays neutral so the user's content
provides the character.

## Constraints Every Styling Change Must Survive

- Light and dark themes, including system-following mode.
- All UI-scale steps and reading-text sizes.
- Reduced-motion preference.
- The frameless macOS window (traffic-light inset, drag regions) alongside
  plain browser and non-macOS chrome.
- A visible, non-layout-shifting focus ring on every interactive element.

## Contribution Guidance

- New styles consume semantic tokens; introducing a literal color, radius, or
  duration into a component is a defect unless it defines a new role.
- When adding a component, match the density, stroke, and voice rules above
  before customizing anything.
- Propose changes to this language (a new role, a revised palette) as a
  change to this document plus the token layer in the same change — not as a
  one-off component style.
