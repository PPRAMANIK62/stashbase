/** The one place the renderer asks the browser for the clipboard. A host that
 *  offers none and a host that refuses the write are the same answer to a
 *  caller — the value did not get there — so both arrive as a rejection and a
 *  caller has one outcome to handle instead of two. */
export async function writeToClipboard(text: string): Promise<void> {
  const written = navigator.clipboard?.writeText(text);
  if (!written) throw new Error('The clipboard is unavailable.');
  await written;
}
