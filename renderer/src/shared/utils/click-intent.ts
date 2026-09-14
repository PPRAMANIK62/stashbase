/**
 * How long a single click waits to find out it was not the first half of a
 * double click.
 *
 * Any surface where a second click means something else — rename a
 * conversation, type a zoom value — has to hold the single-click action back
 * for this long. One number for the whole app, because the reader has one pair
 * of hands: a window that answers a double click in the file list but misses
 * the same double click in a toolbar teaches nothing except that double
 * clicking is unreliable.
 *
 * Erring long. Sixty milliseconds of extra latency on a click is below what a
 * reader reads as lag, while a window that closes too early swallows the
 * second click and does the wrong thing instead.
 */
export const SINGLE_CLICK_DELAY_MS = 240;
