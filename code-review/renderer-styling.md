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
palette. The badge hues and the brand mark colors are theme-independent on
purpose, because a badge hue is a label and a mark is an identity rather than a
surface.

`--focus-ring` is the single theming point for focus. Every component ring reads
`var(--focus-ring, …)`, and the literal fallback is written only in
`renderer/src/lib/focus-ring.ts`, where it exists so a primitive copied out of
the kit still draws a ring in a project without the token. `--shape-input-radius`
is the one radius published to plain CSS, for the rules that cannot read the
class map.

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
feature wants was public all along and moves to `components/ui`.

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

Rounded is the only supported geometry. `renderer/src/lib/shape-context.ts` is a
fixed map from role to radius class rather than a variant union, `useShape()` is
a plain lookup, and the upstream pill variation is not exposed. Nothing chooses a
shape, so nothing publishes one.

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
is the same shape at smaller scale, with one hue per thing a badge says.

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
step carries every measurement that moves with it. A component reads the fields
it needs and never keeps its own two-entry map of a height, a type step, a
padding, a gap, a glyph size, or a switch geometry. `useSize(override)` resolves
explicit prop, then provider, then default, which is what lets one control be
pinned compact inside an otherwise default surface. Only the outermost provider
stamps `data-size` on `<html>`, where the `--fs-*` roles read the document's
step, so a pinned region decides its own subtree and not the page's chrome. The
stamp lands in a layout effect, so the first frame is never a step off.

Elevation is a number. `renderer/src/lib/surface-context.tsx` publishes a level
clamped to 1 through 8, `renderer/src/components/ui/elevated.tsx` adds an offset
and re-provides the result so nesting walks the ladder automatically, and
`renderer/src/lib/surface-classes.ts` maps a level to its background and shadow
pair.

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
`renderer/src/globals.css` is the token and global-rule surface.
`renderer/src/app/shell.css` owns the Electron window surface, where the
titlebar accepts window drag and its control island opts back out.
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
deliberate waits such as hover intent and the acknowledge hold, and the ambient
loop times. Nothing outside that module writes a duration literal.

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
literal, and stroke weight is the primitive's own hover affordance.

Two icon sets stay separate because they are not product controls.
`renderer/src/components/ui/file-type-icon.tsx` maps a file extension to its own
lucide file glyph, and `renderer/src/shared/brand/logo.tsx` draws the mark.

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
