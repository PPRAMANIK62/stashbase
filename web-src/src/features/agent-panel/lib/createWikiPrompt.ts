/** The concise visible action and the fuller write contract sent to the
 * Agent. `wiki/` is the one visible boundary for generated Wiki files; the
 * automatic AI index has an independent lifecycle and is never part of this
 * prompt. */
export const CREATE_WIKI_VISIBLE_PROMPT = 'Create a Wiki for this folder.';

export function createWikiPrompt(): string {
  return `Create or improve the visible Wiki for the folder this chat is scoped to.

Inspect the folder before writing. Keep every generated Wiki file inside wiki/. Use wiki/index.md as the concise entry page: explain what is here, group the important sources by topic, and link to the original files with relative Markdown links. Add focused Markdown pages under wiki/ only when index.md would otherwise become unwieldy.

Preserve the user's existing files and structure. Do not modify anything outside wiki/, and do not move, rename, or delete files. If wiki/ already exists, inspect it first, preserve useful or unrelated material, and update only the pages needed for this Wiki. If a better physical organization would require source-file changes, describe the proposal and ask for explicit approval instead of making those changes.

Perform the allowed edits now. In your final response, list the Wiki files you created or updated and call out important sources you could not cover.`;
}
