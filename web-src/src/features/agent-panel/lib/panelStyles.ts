/**
 * The panel's two shared state marks — a dot and an arc — for the several
 * components that report working/queued/running or connecting.
 *
 * They stay class strings rather than components on purpose: each is a
 * single `aria-hidden` span with no children, no state, and no behavior,
 * sitting inside a line of text that already carries the meaning. Wrapping
 * one would add an element that only forwards a className.
 *
 * The attachment chips that used to live here are now the AttachmentChip
 * component, which owns its own recipe. Content typography (.agent-prose)
 * and the One-Dark diff palette intentionally stay in agent-panel.css; so
 * do the two turn-bubble rules a utility cannot spell, which is why the
 * bubble's box is a class string HERE and its measure is a declaration
 * THERE.
 */
/** Accent status dot used by working/queued/running indicators. Render with
 * `aria-hidden` — the adjacent text carries the meaning. */
export const accentDotClass = 'inline-block size-2 shrink-0 rounded-full bg-accent';

/** Small accent progress arc beside "Connecting to X…" copy — the one
 * connecting-state spinner, shared by the transcript notice and the
 * empty-chat greeting. The global reduced-motion policy zeroes the spin
 * keyframe, leaving a static arc while the adjacent text still conveys
 * the state. Render with `aria-hidden` — the text carries the meaning. */
export const spinnerClass =
  'size-3.5 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent';

/** The user turn's bubble box. Two call sites render it — the sent turn
 * (AgentUserTurn) and the queued preview (AgentMessages) — and they must
 * not drift, because the left/right asymmetry against the full-width
 * reply blocks is the only thing that reads as authorship. It stays a
 * class string rather than a component because the two wrap different
 * children in different arrangements; there is no shared MARKUP here,
 * only a shared box.
 *
 * `agent-turn-head` leads the list as a hook, not a look: the bubble's
 * `min(85%, 620px)` measure and the `:has(.agent-turn-edit)` expansion
 * live in agent-panel.css and key off it.
 *
 * Vertical padding is 10 rather than the 9 it replaces — the bubble is a
 * container holding a message, not a control row, so it snaps UP to the
 * ramp step above and keeps reading roomier than the rows beneath it. */
export const turnHeadClass =
  'agent-turn-head self-end rounded-xl border border-border bg-card px-3 py-2.5 text-base leading-normal break-words whitespace-pre-wrap text-foreground';
