# Storybook patterns for the Fluid component inventory

Research date: 2026-08-31

## Scope

This note compares current Storybook guidance with the checked-in Storybook
setups and stories of mature open-source React component libraries. It informs
the replacement renderer's Fluid Functionalism showcase; it does not describe
Shipping behavior.

Primary sources:

- [Storybook documentation: naming and hierarchy](https://storybook.js.org/docs/writing-stories/naming-components-and-hierarchy),
  [decorators](https://storybook.js.org/docs/writing-stories/decorators),
  [Autodocs](https://storybook.js.org/docs/writing-docs/autodocs),
  [play functions](https://storybook.js.org/docs/writing-stories/play-function),
  [accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing),
  and the [Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon/index).
- [Storybook's own component stories](https://github.com/storybookjs/storybook/tree/next/code/core/src/components/components),
  including its [Button](https://github.com/storybookjs/storybook/blob/next/code/core/src/components/components/Button/Button.stories.tsx)
  and [Modal](https://github.com/storybookjs/storybook/blob/next/code/core/src/components/components/Modal/Modal.stories.tsx)
  examples.
- [Chakra UI's Storybook preview](https://github.com/chakra-ui/chakra-ui/blob/main/.storybook/preview.tsx)
  and its [component story directory](https://github.com/chakra-ui/chakra-ui/tree/main/packages/react/__stories__).
- [React Spectrum's Storybook configuration](https://github.com/adobe/react-spectrum/blob/main/.storybook/preview.js)
  and its per-component [React Aria stories](https://github.com/adobe/react-spectrum/tree/main/packages/react-aria-components/stories),
  plus its isolated [Chromatic visual matrices](https://github.com/adobe/react-spectrum/tree/main/packages/@adobe/react-spectrum/chromatic).
- [Storybook Design System's configuration](https://github.com/storybookjs/design-system/tree/master/.storybook)
  and [co-located component stories](https://github.com/storybookjs/design-system/tree/master/src/components).

## Patterns worth adopting

### One component entry, several purposeful states

All surveyed libraries give a component its own story entry rather than one
repository-wide gallery. Storybook recommends matching the sidebar hierarchy
to the file hierarchy for a large catalogue. Chakra and React Spectrum keep
one story module per component; Storybook's own source co-locates a story with
each component. Compound parts are demonstrated together under their public
parent, as Storybook does for Modal, rather than appearing as disconnected
implementation primitives. Storybook's
[multiple-component guidance](https://storybook.js.org/docs/8/writing-stories/stories-for-multiple-components)
supports documenting public child parts as `subcomponents` without giving
every internal module a sidebar entry. Use typed CSF with `satisfies Meta` and
`StoryObj` so story args remain aligned with the component API.

A component entry normally combines:

1. `Default` or `Playground`, with representative args and useful controls;
2. small visual matrices for finite public dimensions such as size, variant,
   surface, disabled state, or icon placement;
3. separate stories for behaviorally distinct states such as controlled use,
   loading, empty, overflow, nested overlays, keyboard interaction, and error;
4. one or more realistic compositions when the component's contract only
   makes sense with its trigger, content, or child parts.

Storybook's Button story uses compact matrices for variants, sizes, icons, and
pseudo-states. Chakra publishes many named behavior examples but reuses the
same examples as its documentation. React Spectrum goes deeper on primitive
edge cases. The useful principle is representative coverage plus explicit
risk cases, not a Cartesian product of every prop.

When a finite state product is genuinely useful for visual regression but too
large for readable documentation, keep it in a separate visual-matrix story
and exclude it from Autodocs. React Spectrum uses dedicated Chromatic stories
for this purpose and pins their viewport, theme, scale, locale, and animation
conditions. Narrative stories should stay understandable and copyable.

### A production-like global preview

Global decorators are the official mechanism for context and rendering that
every story requires. Chakra's preview installs its real system and color-mode
providers and offers a theme toolbar. React Spectrum centralizes its provider,
theme, strict-mode, scrolling, and Shadow DOM switches. Storybook Design
System loads its fonts and global style once in the preview.

For StashBase, the preview should import the renderer's real `globals.css` and
Inter package and mount the same Fluid rounded-shape, size, surface, icon,
tooltip, and reduced-motion providers as the application. Do not reproduce
those defaults inside individual stories. A small global toolbar may vary Fluid
surface, size, and reduced-motion context when that variation reveals an actual
component contract. The renderer deliberately does not expose the upstream
pill shape. Use component-level decorators only for special canvas
needs such as a fixed-height overlay boundary, narrow sidebar container, or
contrasting surface.

For the StashBase catalog, every public component sets a bounded canvas width
and minimum height that fit its actual interaction surface. Compact controls
use a small framed surface; larger compositions such as tables, conversations,
and the sidebar receive their working dimensions. Do not use a full-height,
full-width background for ordinary component stories.

### Stories as executable component evidence

Storybook play functions run after rendering and support user interaction and
assertions. Storybook's current Modal story uses accessible queries,
`userEvent`, named `step`s, and assertions to prove opening and dismissal.
Storybook's own repository directs React component behavior tests into
co-located stories, and the Vitest addon can execute them in real Chromium
without a separately running Storybook.

Use play tests for Fluid components whose value is behavioral: Accordion,
Ask User Questions, Checkbox/Radio Groups, Color Picker, Dialog, Dropdown,
Input Copy, Mobile Drawer, Select, Sidebar, Slider, Switch, Tabs, Thinking
Steps, and Tooltip. Query by role, accessible name, label, or visible text;
assert user-observable state and focus rather than Base UI internals or class
names. Keep pure visual inventories, such as Badge variants or Table density,
as render-only stories.

Install the accessibility addon and set `parameters.a11y.test = "error"`
globally so automated story runs fail on detected violations. A narrowly
documented per-story exception may be `todo` while a known upstream issue is
tracked; it should not silently disable the check. Run stories through the
Storybook Vitest project in CI, while keeping application integration and
Electron journeys in their existing evidence layers.

### Autodocs with deliberate escape hatches

Autodocs is a sustainable baseline when the component meta supplies the real
component and stories use typed args. Enable the `autodocs` tag globally and
write concise component/story descriptions where usage is not self-evident.
Use MDX only for catalogue-level guidance or a compound component whose
composition and constraints need a curated narrative; Storybook explicitly
positions MDX and Doc Blocks as the extension point when generated docs are
insufficient.

Controls should expose meaningful public inputs. Disable controls for
composition callbacks, provider plumbing, internal Base UI props, and values
whose generated editor is misleading. A story's source should remain a
copyable consumer example, with harness markup kept in decorators where
possible.

### Deterministic fixtures

Stories should not depend on the network, the current clock, randomness,
Electron APIs, or user files. Keep a small shared fixture module for stable
labels, messages, table rows, option lists, and attachment metadata. Use local
image/PDF assets or deterministic object URLs for File Thumbnail. Reset
controlled state per story and replace long animation or pending timers with
explicit story-controlled states. This keeps docs, interaction tests, and
future visual snapshots reproducible.

## Recommended StashBase catalogue

Keep one `*.stories.tsx` beside each public file under
`renderer/src/components/ui/`. Group sidebar titles explicitly so filenames
can remain flat:

- `Fluid/Actions and Inputs`: Button, Input Group, Input Copy, Checkbox Group,
  Radio Group, Select, Slider, Switch, Color Picker;
- `Fluid/Navigation and Disclosure`: Accordion, Dropdown, Sidebar, Tabs,
  Subtle Tabs;
- `Fluid/Overlays`: Dialog, Mobile Drawer, Tooltip;
- `Fluid/Content and Status`: Badge, Card, Table, Scroll Area, File Thumbnail,
  Thinking Indicator, Thinking Steps;
- `Fluid/Agent Patterns`: Ask User Questions, Chat Message, Input Message.

Internal `menu-item`, `sidebar-core`, and `sidebar-menu` modules should be
covered through their public owners rather than receiving top-level catalogue
entries. Add a small MDX introduction for the Fluid source snapshot, Base
UI-only rule, provider defaults, and host adaptations. Do not add a second
token or component implementation in Storybook: stories import the installed
renderer source directly.

The first implementation pass should give every public component a useful
default story, then add matrices and play tests in proportion to behavior and
risk. A story-count target is less useful than requiring each public component
to show its normal state, significant variants, constrained/disabled/error
states where applicable, and the keyboard/focus path that defines its
interaction contract.
