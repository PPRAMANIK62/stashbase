/**
 * The one sentence a refused copy reads as.
 *
 * The copy port is wired in composition over the Library's own import, and the
 * Library owns how its refusals read — a private repository, a name already
 * taken, a missing Git. The shop does not map that ladder a second time; it
 * only names what did not happen and carries the sentence it was given.
 */
export function copyFailureMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : '';
  return detail ? `Could not get this Wiki: ${detail}` : 'Could not get this Wiki.';
}
