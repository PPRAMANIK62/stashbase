# Renderer Styling

Implementation contract for how the renderer is styled. Visual intent lives in
`design-docs/visual-style.md`. Layering and import rules for the renderer as a
whole live in [Renderer Architecture](renderer-architecture.md). This file
records the token surface, the primitive layer, and the gates a styling change
has to pass.

Fluid Functionalism is the complete visual and component system. The renderer
owns no parallel token hierarchy, no second primitive set, and no visual
language of its own. The `@fluid` registry declared in `renderer/components.json`
is configured only as a source installer, so the registry runs at install time
and never at runtime. Stock shadcn components are not used. Every dual-flavor
component takes the Base UI registry path, so `@base-ui/react` is a dependency
of `renderer/package.json` and no Radix package or import exists anywhere in the
renderer. Runtime registry access, CDN scripts, and remote styles are forbidden.
Everything the renderer paints is bundled.

## Token and theme surface

`renderer/src/globals.css` is the only file that declares a token. It carries
the semantic colors, the surface and shadow ladders, the Tailwind theme
mapping, the base rules, the native scrollbar theme, and the shared utilities.

Every color token is written once as `light-dark(light, dark)`. Which side
renders is decided by `color-scheme`, not by a variant class. The root declares
`color-scheme: light dark` so an unpinned window follows the OS, and a `.light`
or `.dark` class pins a scope. The token block is declared on `:root, .light,
.dark` rather than on `:root` alone because `light-dark()` inside a custom
property resolves against the color-scheme of the element the property is
declared on, so a forced-theme subtree needs its own resolution point. No
`dark:` variant appears in source.

Two values cannot ride `light-dark()` and switch per theme instead. `--overlay`
is an RGB triplet because components consume it as `rgb(var(--overlay) / α)`, so
the triplet format is the public contract. The shadow ladder uses structurally
different recipes in light and dark rather than different colors, so each ladder
is written out once and the active `--shadow-N` is selected per theme.

The substrate is an eight-step surface ladder, and each surface pairs one to one
with a shadow recipe. `@theme inline` publishes both as the `bg-surface-1..8`
and `shadow-surface-1..8` utilities. Semantic roles sit on top of the ladder:
background, foreground, card, muted, accent, selected, border, destructive, the
status voices `--working` and `--decision`, the diff pair, and a five-hue badge
palette. The diff pair publishes its derived strengths as tokens of their own
(`--diff-*-line` behind a whole line, `--diff-*-token` behind the changed run
inside it), because the same diff is drawn by two renderers in two syntaxes —
a CodeMirror theme object and a Tailwind arbitrary value — and a mix spelled
out at each one is a mix the two can get wrong differently. `--working` is plain ink (an alias of `--foreground`); only
`--decision` keeps a hue. Of the two overlay tints, `--hover` is the one a
row wears for hovered, selected, current, and keyboard-highlighted alike, so
one gray carries one meaning; `--active` is the pressed step only. Hovered
and selected are one treatment throughout: the same tint, the same ink, the
same glyph stroke, and the same weight, since selection never bolds a label.
A hover on a row that already wears the tint paints nothing extra, which the
sidebar overlays, the menu overlays, the file tree's glided highlight, and
the table's highlight each enforce for their own selected row. The badge hues are theme-independent on purpose,
because a badge hue is a label. The brand mark is transparent-backed and
rides the theme's ink (`--brand-accent` carries a light-dark() pair); only
its frame gray is fixed.

`--focus-ring` is the single theming point for focus. Every component ring reads
`var(--focus-ring, …)`, and the literal fallback is written only in
`renderer/src/lib/focus-ring.ts`, where it exists so a primitive copied out of
the kit still draws a ring in a project without the token. `--shape-input-radius`
is the one radius published to plain CSS, for the rules that cannot read the
class map; the radius ladder itself lives in `@theme` and reaches source as the
`rounded-*` utilities, which the Shape section below governs.

`--hairline` is the width every separating line draws at: 1px on standard
displays, half a logical pixel (one device pixel) on hi-DPI panels. The
hairline section at the end of `globals.css` re-points the default-width
border, divide, and px-separator utilities at it, and the shadow ladders'
ring steps consume it directly. A new 1px rule or ring should read the token
rather than write a literal width.

Type scale is five roles, `--fs-display` through `--fs-caption`, exposed as the
`text-display` through `text-caption` utilities and keyed off `html[data-size]`.
The two steps a component also reads through the size ladder, body and caption,
are held equal to the CSS roles by `renderer/src/lib/tokens.test.ts`.

Both typographic voices are bundled rather than native. `renderer/src/globals.css`
imports Inter Variable and Geist Mono Variable from their `@fontsource-variable`
packages, sets `--font-sans` to Inter with a `system-ui` fallback, and sets
`--font-mono` to Geist Mono with a native monospace fallback.
`renderer/src/fluid-registry.test.ts` asserts the Inter package stays a
dependency. Surfaces and chrome are monochrome. Chromatic color is confined to
the status, diff, badge, focus, and brand roles named above, and is not added
for decoration.

The entry documents `renderer/index.html` and `renderer/bug-report.html` declare
the color scheme on `<html>` before the module script evaluates, so a window
never paints its first frame on the wrong scheme.

## The primitive layer

`renderer/src/components/ui/` is the renderer's whole component vocabulary.
Product code reaches a primitive directly. There is no wrapper layer between a
feature and the kit.

`renderer/src/components/internal/` holds the parts a primitive is built out of,
such as the measured collapse, the proximity highlight, the tab strip
machinery, and the sliding sheet. Product code never imports from it. A part a
feature wants was public all along and moves to `components/ui`. The measured
collapse is reached that way: `components/ui/disclosure.tsx` is the region a
product surface installs, taking the measurement itself so a caller states only
what is open, while the internal part stays internal for the wrappers that must
measure something other than their own child.

Installed registry files are reviewed first-party source after generation. One
host adaptation is deliberate and narrow.
`renderer/src/components/ui/file-thumbnail.tsx` resolves the PDF.js worker
through a Vite URL import, so the bundler owns the worker file and no remote
code loads. `renderer/src/fluid-registry.test.ts` scans the component, internal,
and kit trees and fails on `@radix-ui/`, on `next/link`, and on a jsDelivr URL,
so neither a Radix dependency, a framework link, nor a CDN script can come back
with a reinstall.

`renderer/src/lib/` is the kit exactly as the registry emits it, and its
manifest in `renderer/src/fluid-registry.test.ts` is the whole contract for that
directory. Nothing local lands at that root, so a reinstall never has to
reconcile local edits against upstream ones. A kit extension only the components
consume goes under `renderer/src/lib/local/`. Product code goes under
`renderer/src/shared/`, and the kit reaches back into it only for
`renderer/src/shared/utils`. `renderer/src/lib/README.md` states the same rule
where an author of a new module will read it.

A `Button`'s label box gives ground. Both content wrappers the primitive draws
around a label carry `min-w-0`, so a caller that bounds the button, with a
`max-w-*` on a trigger or a row that squeezes it, narrows the label instead of
leaving the content to spill past the button's own edge and over whatever sits
beside it. The primitive supplies the room, not the ellipsis: a caller that
wants the narrowed label to read as truncated puts `truncate` on the span it
owns, which the composer's model-and-thinking trigger does around the model
name while the level stays whole.

Rounded is the only supported geometry, and a corner is two independent
decisions: how big it is, and how full it is.

Size comes from one ladder. `renderer/src/globals.css` replaces Tailwind's own
radius scale inside `@theme` rather than living beside it, so `rounded-lg` at a
call site and `shape.item` through the context resolve to the same number. The
six steps are box sizes, not ranks: `sm` for a 16–24px chip, `md` for a small
block, `lg` for a row, a 28px control or a piece of chrome, `xl` for the 36px
control, `2xl` for a framed list, `3xl` for a card. Replacing the scale rather
than adding to it is what keeps a literal that has not been converted yet from
drifting away from the system.

Readers take values off that ladder and nothing spells a number.
`renderer/src/lib/shape-context.ts` is a fixed map from role to radius class
rather than a variant union, and `useShape()` is a plain lookup. Its roles
mirror the scale one for one — `mark`, `chip`, `item`/`container`/`input`/`bg`/
`mergedBg`, `panel`, `card` — plus `circle`, `glyph`, and `focusRing`, which
name shapes rather than steps. `renderer/src/lib/size-context.tsx` carries the
corners that move with density, because a control's radius steps with its
height the way its padding and glyph do: `radius` for the bounded control, and
`segmentRadius` for a segmented item, which is the shortest box a highlight
lands on and cannot borrow the row's. A class string built outside a component
— a module-scope constant, a ProseMirror widget — reads `shapeTokens`
directly, since `useShape()` only returns it and the whole class name still
lives in `shape-context.ts` where Tailwind's scanner finds it.

Fullness is one rule for the whole application. `corner-shape: squircle` on the
universal selector draws a superellipse instead of the circular arc
`border-radius` would, because an arc leaves the edge early and reads thinner as
the radius grows. It is declared on `*` rather than on the shape roles, since a
radius is written in three places and a corner language covering only one of
them would be a new inconsistency; it is inert wherever the radius is zero,
which is most elements. Two exits are deliberate. `.rounded-full` returns to
`round`, so the shapes that mean something — a status dot, an avatar, a switch,
a badge, the composer's send — stay true circles rather than approximations,
and the native scrollbar thumb takes the same exit in plain CSS. Anything
carrying `rounded-[inherit]` takes `corner-shape: inherit`, because `corner-shape`
is not an inherited property: the button's fill layer and the scroll area's
viewport sit inside a host, and without it a circular button drew a squircled
fill inside a round outline. The property is Chromium 139+, which is what this
application ships; elsewhere the declaration is dropped and the corner falls
back to the arc, so nothing depends on it.

One invariant bounds the ladder. A radius at or past half its box is clamped by
the UA into a capsule, and `design-docs/visual-style.md` reserves that shape for
semantics. It is why the control radius stops at 12 rather than following the
card upward — the compact icon-only button is a 28px square, where 14 is a
circle — and why a segmented item at 24px takes its own smaller step.

The renderer keeps a primitive only while product code reaches it, directly or
through another primitive. A primitive that loses its last caller is deleted
rather than kept, and is reinstalled from the registry when a caller appears.
Accordion, ask-user-questions, card, checkbox group, color picker, input copy,
radio group, and slider exist upstream and are not installed for that reason.
`renderer/src/fluid-registry.test.ts` proves the rule. It walks the import graph
from every product source file inward, counts neither a story nor a sibling
primitive as a caller, and fails on an orphan. Its allowlist for primitives
without a product caller is empty, and the test asserts it stays empty. The same
file requires every internal part to be reachable through a public primitive and
requires a story for every catalogued component.

## Composing class names

`cn` in `renderer/src/lib/utils.ts` is the only way a class string is assembled.
It extends tailwind-merge with three groups the stock config does not know. The
type-scale utilities are registered as `font-size` entries, because bucketing
them with the text-color utilities silently dropped one of
`cn('text-caption', 'text-muted-foreground')`. The named `duration-*` and
`delay-*` steps are registered for the opposite reason, because tailwind-merge
recognizes those namespaces only with a numeric or arbitrary suffix and would
otherwise emit a named step and a numeric one together.

A primitive declares its fills and its stateless variants with `cva`, and takes
every measurement from the size and shape contexts rather than from a local map.
`renderer/src/components/ui/button.tsx` is the reference. It names four variants
and no `color` prop, keeps its fill recipes in two maps keyed by the variant type
rather than by `string`, and reads height, type step, padding, gap, glyph size,
and radius out of `useSize()` and `useShape()`. `renderer/src/components/ui/badge.tsx`
is the same shape at smaller scale, with one hue per thing a badge says. Its
gray, the badge that classifies rather than alerts, sits on `--muted` in
`--muted-foreground` ink rather than on the control tint, so a category label
reads a step quieter than a button beside it.

A consumer picks behavior with props. `className` carries layout and never a
restyle, and a caller asking for a fifth fill is asking for a token rather than
a prop. Class names are written out in full, because Tailwind scans source for
whole class names and one assembled by concatenation is never generated. Where a
value has to be shared across spellings, the custom property is shared and the
spelling is not, which is why `renderer/src/lib/focus-ring.ts` publishes one
fallback property and writes each of its four ring spellings in full.

## Composition and density

`renderer/src/app/providers.tsx` mounts the application's own outer concerns,
StrictMode and the query client, around `FluidProviders`.
`renderer/src/shared/runtime/fluid-providers.tsx` is the Fluid stack itself, in
order: `MotionConfig` with `reducedMotion="user"`, then `SizeProvider`, then
`SurfaceProvider` at level 1, then `IconProvider`, then `TooltipProvider`. The
stack lives in `shared/runtime` rather than in the app because three places
mount it, the running app, the Storybook canvas, and the test that scores every
story, and a surface rendered under a different stack is not the surface the
product ships. The shape ladder needs no provider.

Density is one object, not one number. `renderer/src/lib/size-context.tsx` holds
two steps, `default` at a 36px control height and `compact` at 28px, and each
step carries every measurement that moves with it; both read the 13px label,
since the label is what is read and the compact box shrinks around it, and
`globals.css` holds the same body size for `data-size='compact'`. A component reads the fields
it needs and never keeps its own two-entry map of a height, a type step, a
padding, a gap, a glyph size, or a switch geometry. `useSize(override)` resolves
explicit prop, then provider, then default, which is what lets one control be
pinned compact inside an otherwise default surface. Only the outermost provider
stamps `data-size` on `<html>`, where the `--fs-*` roles read the document's
step, so a pinned region decides its own subtree and not the page's chrome. The
stamp lands in a layout effect, so the first frame is never a step off.

Which step a surface sits on is decided where the surface is composed, not
inside the primitive. The workspace titlebar's row reads the default step;
its sidebar-mirroring corners, the reopening trigger with the arrows and the
Chat toggle, pin `size="compact"` so they hold the same square the sidebar's
band draws (`renderer/src/app/composition/layout/workspace-titlebar.tsx`).
Pane and panel surfaces pin the compact step: `WorkspaceSidebar` wraps its
whole column, the titlebar band, the folder header, the navigator, and the
footer, in `SizeProvider size="compact"`, which sets the band's toggle and
arrows on the compact square, which is what puts the `SidebarMenuButton`
rows of the Chats panel, the outline, New chat, and the footer on the 28px
rhythm without a prop on each; the Files tree's rows are `Button
size="compact"` with `gap-2` so their label meets the menu rows' text line;
the account menu the footer row opens inherits that compact step through its
portal, and its rows pass `gap-2 px-2` — the inset and glyph gap
`sidebar-menu-button` writes — so a menu label lands on the column's text line
rather than on the compact step's tighter menu one;
the folder header sits one step taller at `h-8` with the rows' 13px label;
the sidebar's mode switch and navigator strip and the Markdown mode switch
pass `size="compact"` to `TabsSubtle`, and the two mode switches draw its
`track`, the segmented look, with 30px items so the sidebar's runs at the
band's 32px pitch; the Chat header's actions are `Button
size="icon-compact"`; and the header's history popover wraps its subtree in
`SizeProvider size="compact"` for the palette primitives. A glyph-only `TabsSubtleItem` takes
`sizeClasses.square` rather than the control height and its padding, so it
is the same square an icon button is. A ghost `Button`'s hover fill is inset
by one pixel and ringed by one pixel of the same tint, so it reads as the
full square beside a tab pill that fills its box. The folder row at the
column's head, the footer rows, and the document tab strip stay at the
default step on purpose; a fourth exception needs a reason in review.

Elevation is a number. `renderer/src/lib/surface-context.tsx` publishes a level
clamped to 1 through 8, `renderer/src/components/ui/elevated.tsx` adds an offset
and re-provides the result so nesting walks the ladder automatically, and
`renderer/src/lib/surface-classes.ts` maps a level to its background and shadow
pair, and to the background alone for a selection pill that rides inside a
muted track. The Settings preset picker lifts its pill three steps with no
shadow: the track already draws the edge, and the light ladder's hairline ring
outlined the pill as a stroke while the dark ring vanished, so the two themes
disagreed about what the pill was. The document tab strip draws no track at
all; its selected tab wears `--hover`, so both themes show one flat lift.

Desktop panes adapt with container queries and the density ladder rather than
with viewport assumptions. `renderer/src/features/documents/ui/markdown/document.css`
declares `container-type: inline-size` on the editor host and takes both of its
reading-measure breakpoints from `@container`.
`renderer/src/features/agent/ui/workspace.tsx`,
`renderer/src/features/gallery/ui/shop.tsx`, and
`renderer/src/features/gallery/ui/overlay.tsx` open a container context for their
own contents. The one remaining live window measurement is
`renderer/src/lib/local/use-compact-window.tsx`, which exists because nothing
drives the ambient size context off real window width and the Settings shell has
to choose between a nav rail and a drawer.

Four stylesheets exist, and each owns a boundary Tailwind utilities cannot.
`renderer/src/globals.css` is the token and global-rule surface. A global
default that a utility class is meant to override, such as the focus ring or
`--scroll-fade-size`, sits in `@layer base`, because an unlayered declaration
outranks every Tailwind layer and would leave the override dead.
`renderer/src/app/shell.css` owns the Electron window surface, where the
titlebar accepts window drag and its control island opts back out, and where
the room for macOS's traffic lights lives: the preload stamps the platform on
the document root and mirrors the window's native fullscreen there as the
desktop reports it, and only the exact `darwin` marker pads the sidebar's
header and, once the sidebar is collapsed, the titlebar's island, with
fullscreen taking the room back.
`renderer/src/features/documents/ui/markdown/document.css` and
`renderer/src/features/documents/ui/pdf/document.css` are the two per-viewer
exceptions, and each maps a third party's anatomy onto the semantic roles. The
Markdown sheet drives Crepe's own `--crepe-*` variables from the app's tokens and
styles the code-block, toolbar, and slash-menu anatomy the package publishes. The
PDF sheet owns the text-layer geometry pdf.js requires and tints selection from
`--selected`. Neither introduces a color, a radius, or a duration of its own.

## Motion

`renderer/src/lib/springs.ts` is the one place a duration is written. It holds
three entry steps, the matching exit steps, which run shorter because a leaving
element is already understood, three spring tiers built from those steps, the
eased collapse tiers, the deliberate waits such as hover intent and the
acknowledge hold, and the ambient loop times. Nothing outside that module
writes a duration literal or an easing curve.

Expand and collapse is the one travel that is not a spring, and the one that
does not take the ladder above. A region's size is a box of space opening and
closing rather than an object arriving, and a spring's launch reads as a shove
when what it displaces is every row below it or the whole column beside it, so
`collapseTween` eases. It carries its own two steps because a region is read
while it travels rather than once it lands, and they are the host platform's
numbers: 0.25s is AppKit's default animation length, 0.35s is SwiftUI's default
for `.easeInOut`, and the curve is Core Animation's ease-in-ease-out,
`0.42, 0, 0.58, 1`. Unlike the spring tiers, a collapse does not shorten on the
way out. A leaving object is already understood and need not be waited on; a
region is not an object, and AppKit closes one over the length it opened it, so
a close that outran its open would read as a second control rather than the
same reversible state.

Every region that opens and closes reads it, on whichever of the two steps
matches its travel. The `moderate` step is a region inside a pane: the measured
`Collapse`, the file tree's expanded group, and the navigator's fold, which
travels a flex share rather than a height. The `slow` step is a whole column or
a pane-wide seam: the sidebar shell's open and close, and the seam between the
Agent and the document. That seam takes one transition for both panes, chosen
by the direction of the sweep rather than per pane, because the two are halves
of one rule and a direction read per pane would land them a frame apart. The
sidebar's drag-resize keeps the spring: a drag that has flipped past its
threshold is continuing a movement the pointer started, which is what momentum
is for.

The same three numbers are published to CSS as `--motion-fast`, `--motion-base`,
and `--motion-slow`, and reachable as the `duration-fast/base/slow` and
`delay-fast/base/slow` utilities, so a class transition and a framer spring
meeting on the same element land together. `renderer/src/lib/tokens.test.ts`
parses `renderer/src/globals.css` and fails when the two spellings disagree. It
reads each declaration out of the block it actually lives in, because the
reduced-motion query redeclares every motion step and the compact scope
redeclares every type step.

Reduced motion is honored twice, because the two engines do not read each other.
The CSS side zeroes the three step tokens under `prefers-reduced-motion: reduce`,
which settles every token-driven transition in the application including the ones
inside primitives, and adds a catch-all for animation, transition, and scroll
behavior declared before the tokens existed. The value is 1ms rather than 0s
because a zero-duration transition never fires `transitionend` and code waiting
on one would hang. The JS side is `MotionConfig` with `reducedMotion="user"` plus
`useMotionTier` in `renderer/src/lib/use-motion-tier.ts`, which takes the tier a
component wants and returns either that tier or `instant`.
`renderer/src/lib/tokens.test.ts` also asserts the reduced-motion counterpart
exists, so a step that gains a CSS spelling without one fails.

## Icons

Every primitive asks for an icon by role through `useIcon` in
`renderer/src/lib/icon-context.tsx` instead of importing a lucide component.
`IconName` is a closed vocabulary of eleven roles, closed to what is actually
asked for. Adding a role means adding the name, giving it a default, and having a
caller, in that order. `IconProvider` lets a host swap the whole set or a single
entry. Glyph size comes from the size ladder's `icon` field rather than a
literal. A surface that carries a scale of its own is the exception and says so
at the call site: a transcript chip on a 12px text line, a tile glyph measured
off its thumbnail.

Which glyph answers the pointer follows from which element wears the hover tint,
because one element lights at a time. Where the glyph is itself the control and
nothing beneath it lights — a button, a tab, a select item, a disclosure header
— it rests at 1.5 in `--muted-foreground` and goes to 2 in `--foreground` when
it is hovered, selected, or active. Where it rides a row that wears the tint, it
is a label rather than a control: it rests in `--foreground` at 1.5 and never
changes colour, stroke, or weight, since the row has a persistent selected state
and hovered and selected are one treatment, so a reacting glyph would leave the
current row permanently emphasized. `RowIcon` in
`renderer/src/components/ui/sidebar-menu-label.tsx` holds that for the menu rows
and `renderer/src/features/workspace/ui/file-tree-rows.tsx` for the tree, the
latter with an `!important` stroke that keeps the button primitive's own
thickening off a row it composes. A row's trailing control
(`renderer/src/components/ui/sidebar-menu-action.tsx`) takes neither recipe
whole: the row beneath it already draws the fill, so the action draws none and
darkens its glyph alone. `design-docs/visual-style.md` states the same rule as
product intent, and the two are maintained together.

Resting at 1.5 is a choice every glyph has to make, because lucide's own default
is 2 and a glyph that names no weight is not neutral — it is a step heavier than
everything a primitive drew beside it. A standalone glyph in a feature therefore
names its `strokeWidth`, and the one glyph set drawn from data carries the
defaults itself: `renderer/src/components/ui/file-type-icon.tsx` maps a file
extension to its own lucide file glyph at the ladder's size and the resting
stroke, so one Markdown file draws the same mark in a search result, a mention
row, and a transcript chip. `renderer/src/shared/brand/logo.tsx` draws the product mark
and stays separate for the same reason: neither set is a product control. A brand
mark keeps its own strokes; the OpenQuill feather alone is a lucide glyph, and
where it stands beside a title rather than beside vendor marks it takes the
chrome's stroke.

## Accessibility

The renderer targets WCAG 2.2 AA.

Every story in the renderer is mounted and scored with axe by
`renderer/src/stories.a11y.test.tsx`, feature stories included, because a
Settings panel is as much a shipped surface as a button. Each story is scored in
three environments, default size in light, compact in light, and default size in
dark, and its `play` function runs first where it has one, so an overlay that
only exists once opened is scored open. Scoring runs over `body` rather than the
render container because the overlay primitives portal their surfaces out of it,
and `renderer/src/globals.css` is imported because several rules read computed
visibility. `region` runs as its own pass with the portal roots excluded, because
content outside a landmark is a real finding but where an overlay's portal lands
relative to a page's landmarks is the composing application's decision rather
than a primitive's.

Two suppressions are structural. `color-contrast` is disabled because happy-dom
computes no layout and resolves no cascade, so every ratio it could report would
be measured against colors nothing painted. Base UI's focus-trap sentinels are
excluded because they are deliberately tabbable `aria-hidden` spans the vendor
owns and assistive technology never lands on one.

`renderer/src/test/story-canvas.tsx` owns the provider stack, the theme
application, and the bounded canvas a story is composed inside, and both
`renderer/.storybook/preview.tsx` and the accessibility test import it, so the
claim that the test scores the story anyone sees is structural rather than a
comment. The canvas is a `<main>`, because a story is the whole of its page while
it is on screen; a story that brings its own landmarks declares
`parameters.ownsLandmarks` so a second `<main>` is not nested inside the first.
Every `components/ui` test that exists asserts no violations through
`expectNoA11yViolations` in `renderer/src/test/axe.ts`.

`.oxlintrc.json` enables the jsx-a11y plugin and names twelve of its rules at
error on top of the correctness category it already promotes, including
`click-events-have-key-events`, `interactive-supports-focus`,
`label-has-associated-control`, `control-has-associated-label`, and
`no-autofocus`. The base layer in `renderer/src/globals.css` gives every
natively focusable element that no component styles the same token ring at the
shared radius, so the UA default that follows the OS accent color never shows
through, and it sits in `@layer base` so a component that draws its own ring is
not double-ringed.

## Enforcement

`scripts/renderer/conventions.mjs` holds the rules the linter cannot express. It
runs as `pnpm check:renderer-conventions` and as the `conventions` gate inside
`pnpm check:web`. It walks `renderer/src`, then applies each pattern to the files
that check's own predicate selects. Source means a TypeScript or TSX file that
is neither a test nor a story, so a CSS file is outside the pattern checks and
is reached only by the token gate below. The styling rules are:

- No hex color in source, outside `renderer/src/lib/focus-ring.ts` and
  `renderer/src/shared/brand/logo.tsx`. Colors come from tokens.
- No `dark:` variant in source. Themes go through `light-dark()` tokens.
- No motion literal in source, meaning neither a numeric `duration-<n>` utility
  nor a `duration: 0.x` transition object. Durations are the named steps.
- No `rounded-*` literal in source. Corners come from a `useShape()` role,
  from the size ladder, or from `shapeTokens` where no component wraps the
  string, because a radius spelled at a call site cannot follow any of them and
  is what lets one surface fall behind when a step moves. The check exempts the
  two modules that own the values and the story canvas. Four structural cases
  carry a `shape-literal:` note on their own line instead, the way a selector
  query carries `dom-contract:`: a corner inherited from a host, a radius being
  removed rather than chosen, a variant prefix no class variable can ride, and
  a descendant variant. `radiusLiteralsPending` is the escape for a file not
  converted yet and is empty; the check asserts it stays empty.
- Class-name assertions, `toHaveClass` and `className).toContain`, only in
  `components/ui` tests, where the class is the primitive's observable contract.
  Every other test asserts behavior.
- A selector query in a test outside `components/ui` carries a
  `// dom-contract:` note on the line, naming why the markup is the contract.
- A source file over 150 lines opens with a doc comment saying what it owns.

The design-token gate is the same script's last check. Every custom property
declared in `renderer/src/globals.css` must have a reader, because a token
nothing reads is dead weight a reader still has to account for and that file is
one place where the consumer is never next to the declaration. The gate resolves
both spellings before it calls a token unreferenced. It collects every `var()` in
the renderer's own TypeScript, TSX, and CSS files, which covers a token read by
another token and a token read by an `@utility` block. For a token declared
inside `@theme` it also accepts a mention of any utility name Tailwind would
generate from that namespace, since `--color-muted` is reached as `bg-muted` or
`hover:bg-muted/50` and never through `var()`. A token with neither is deleted
rather than kept.

The third escape is `tokenConsumers`, which names a token whose only reader is
CSS this repository does not own, paired with the consumer that reads it. It is
empty today, because every token in `renderer/src/globals.css` has a reader
inside `renderer/src`. The list only shrinks, and an entry naming a token that no
longer exists is itself a failure.

`components/ui` gains no new sibling tests. Its proof is the story score and the
reachability check, which is why `renderer/vite.config.ts` leaves
`src/components/**` out of the coverage measurement entirely rather than giving
it a floor a line count could satisfy.

## Implementation Map

| Concern | Primary owner |
|---|---|
| Tokens, theme switching, global rules, shared utilities | `renderer/src/globals.css` |
| Registry configuration and installed style | `renderer/components.json` |
| Primitive vocabulary | `renderer/src/components/ui/` |
| Parts a primitive is built out of | `renderer/src/components/internal/` |
| Kit as the registry emits it | `renderer/src/lib/` |
| Local kit extensions | `renderer/src/lib/local/` |
| Class-name composition | `renderer/src/lib/utils.ts` |
| Geometry | `renderer/src/lib/shape-context.ts` |
| Density ladder and the `data-size` stamp | `renderer/src/lib/size-context.tsx` |
| Elevation ladder | `renderer/src/lib/surface-context.tsx`, `renderer/src/lib/surface-classes.ts` |
| Motion steps, tiers, and waits | `renderer/src/lib/springs.ts` |
| Reduced-motion resolution for framer | `renderer/src/lib/use-motion-tier.ts` |
| Focus indicator recipe | `renderer/src/lib/focus-ring.ts` |
| Icon roles and the swappable set | `renderer/src/lib/icon-context.tsx` |
| Provider stack every Fluid surface needs | `renderer/src/shared/runtime/fluid-providers.tsx` |
| Application composition around that stack | `renderer/src/app/providers.tsx` |
| Electron window surface | `renderer/src/app/shell.css` |
| Markdown viewer third-party bridge | `renderer/src/features/documents/ui/markdown/document.css` |
| PDF text-layer geometry | `renderer/src/features/documents/ui/pdf/document.css` |
| Story canvas shared by catalog and test | `renderer/src/test/story-canvas.tsx` |
| Catalog and its accessibility reporting | `renderer/.storybook/main.ts`, `renderer/.storybook/preview.tsx` |
| Convention and token gates | `scripts/renderer/conventions.mjs` |
| Gate runner | `scripts/renderer/check-web.mjs` |

## Validation

- `pnpm check:renderer-conventions` for the styling conventions and the
  design-token gate.
- `pnpm test:renderer` for the evidence in code. It runs
  `renderer/src/lib/tokens.test.ts` for the CSS and TypeScript token pairs,
  `renderer/src/fluid-registry.test.ts` for registry exclusivity, the kit
  manifest, primitive reachability, and story coverage,
  `renderer/src/stories.a11y.test.tsx` for the axe score of every story in three
  environments, and the `components/ui` tests.
- `pnpm lint:web` for the jsx-a11y rules and the per-layer import restrictions,
  `pnpm typecheck:web`, and `pnpm build:web`.
- `pnpm build:storybook` for the production-equivalent catalog the stories are
  reviewed in.
- `pnpm check:web` runs all eleven renderer gates to completion and reports each
  one, rather than stopping at the first failure.
- `pnpm test:docs` when this contract changes.
- Composition, contrast, and dark-mode hierarchy are reviewed by eye, in
  `pnpm storybook` and in a driven pass through the built application. No pixel
  baseline exists and none is planned, so a styling change records what it
  looked at.

## Known Gaps

- `design-docs/visual-style.md` names a system UI sans for chrome and a bundled
  Geist for reading surfaces. `renderer/src/globals.css` sets `--font-sans` to
  bundled Inter Variable for both. The monospace voice agrees.
- Nothing scores color contrast automatically. Both axe runners disable the
  `color-contrast` rule because happy-dom paints nothing, so contrast rests on
  review by eye in the catalog and in the built application.
- Stacking has no ramp. Overlay layering is written as individual Tailwind `z-*`
  utilities at each surface, and no gate holds the order between a tooltip, a
  menu, and a dialog.
- **No gate measures step consistency.** Which step a surface sits on, the
  glyph size and stroke it draws, and the fill its pill wears are held by the
  composition rules above and checked by review. The 2026-09-14 audit was a
  driven probe over the built application reading boxes, glyphs, computed
  stroke widths, type, and hover fills; nothing runs it in CI.
