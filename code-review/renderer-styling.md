# Renderer Styling

Implementation contract for how the renderer is styled. Design intent
(voice, color language, density) lives in `design-docs/visual-style.md`;
this file records the mechanics a change must respect.

## Layer model

1. **Semantic theme variables** (`web-src/src/styles/globals.css` `:root`
   blocks) — the only place literal colors, radii, and motion values are
   defined, once per theme. `data-theme` on `<html>` switches themes;
   'system'/absent follows the OS preference.
2. **Tailwind theme mapping** (`web-src/src/styles.css` `@theme inline`) —
   exposes those roles as utilities. Chrome type scale `text-2xs..4xl`
   (10..30px, every step multiplied by `--ui-scale`), radius scale
   `rounded-xs/sm/md/lg/xl` = 2/4/6/8/10px, `shadow-low`/`shadow-elevation`,
   `duration-fast`/`duration-standard` (via the `--transition-duration-*`
   namespace — the bare `--duration-*` namespace generates nothing),
   `ease-ui`, and the semantic colors. `muted` is the subtle SURFACE role;
   `muted-foreground` is subdued text. The `dark:` variant is redefined to
   follow `data-theme`; never rely on the raw media query.
3. **Primitives** (`web-src/src/components/ui/`) — shadcn-generated Base UI
   adapters (button, input, segmented-control, card, dialog, alert-dialog,
   menu, popover, toast, tooltip, status). Feature code must not recreate
   their focus, Escape, outside-press, collision, timer, or announcement
   behavior, and new buttons/inputs/selectable groups use these instead of
   bespoke classes.
4. **Utility classes in JSX** — everything surface-specific. Tailwind is
   utility-only (no preflight): UA margins on `<p>`/`<h*>` are not reset, so
   migrated markup zeroes them explicitly where it matters.

## Enforcement

`web-src/src/__tests__/renderer-foundation.test.ts` locks the mapping, the
type/radius scales, and bans `text-[calc(` and `bg-[var(--hover)]` in
components. Extend it when the contract grows; never weaken it to land a
change.

## CSS exemptions — the only rules allowed to stay in styles/*.css

- **Electron chrome** (globals.css): `.app` grid and splitters, the macOS
  drag regions (the `.sidebar-drag-zone` traffic-light clearance band and
  the `.tab-strip` empty-background drag with its `no-drag` opt-outs —
  there is no titlebar strip), `body.is-electron` variants,
  reduced-motion policy block.
- **Tab strip** (mainpane.css): `electron/tab-strip-layout-smoke.cjs` reads
  this file raw and asserts layout from it — migrate the test before
  migrating the CSS.
- **Rendered-content typography**: `.doc` (Markdown reading view), Crepe
  variable bridge (`.crepe-shell`), `.agent-prose` and agent thinking/diff
  blocks, One-Dark syntax palette, and CodeMirror-generated JSON token classes.
  JSON token classes consume the light/dark `--syntax-json-*` roles from the
  global token layer; they never embed a fixed palette in the component.
  Content follows `--reading-font-size`, not the chrome scale, and may use its
  own serif/mono voices.
- **State-machine and imperative-DOM hooks**: `.tree-row` family with
  drag-drop and `format-*` signature colors, sticky `agent-turn*` family
  (IntersectionObserver `stuck`), CodeMirror-created DOM
  (`.agent-input`, mention popups), `input.flash-focus`,
  `.pdf-page-highlight` + keyframes, spinner keyframes referenced by the
  reduced-motion block.
- **Style-free marker classes** kept as querySelector/behavior hooks only
  (e.g. `.agent-view`, `quick-open-veil`) — do not re-grow
  styling onto them.

Small still-unmigrated stragglers (`.migrate-*` cascade modal content,
`.transcription-model-*`, `.capture-state-*`, `.clipboard-offer-preview`,
`.empty-list`, preparation icons) are pending, not exempt — migrate them
when touching their components, deleting the rules in the same change.

## Review checklist for styling changes

- No new hex/rgb literals, radii, font sizes, or durations outside the token
  layer; no `text-[calc(...)]`; surface tints use the accent/status ramps.
- Works in light, dark, and system themes (tokens flip — verify no raw
  `dark:` media assumptions) and at all `--ui-scale` steps.
- Focus ring visible and non-layout-shifting; reduced-motion policy holds
  (no transform/layout animation under it).
- Deleting a component deletes its styles; anything left behind in
  styles/*.css needs an exemption category above, or it is a defect.
