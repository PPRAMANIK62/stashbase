/**
 * Waits every Milkdown probe shares.
 *
 * `@milkdown/plugin-listener` debounces `markdownUpdated` by 200 ms, so a
 * probe that counts how many updates fired — including the ones that must
 * fire none — has to outlast that window before it reads the count. A settle
 * shorter than the debounce reports zero updates for a change that did fire,
 * which reads as a pass. The wait is the debounce itself, not a guess about
 * scheduling, so it lives here once instead of at each call site.
 */
const LISTENER_DEBOUNCE_MS = 200;
const LISTENER_SETTLE_MS = LISTENER_DEBOUNCE_MS * 2;

export function settleMarkdownListener(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, LISTENER_SETTLE_MS);
  });
}
