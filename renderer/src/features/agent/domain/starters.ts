/** Top-level names of the folder a Chat is scoped to. Nested entries are
 *  intentionally absent: starters point at things the user can see in the
 *  sidebar without expanding anything. */
export interface AgentScopeOutline {
  files: string[];
  folders: string[];
}

export interface AgentStarter {
  id: string;
  label: string;
  prompt: string;
}

const ANCHOR_FILES = ['README', 'MISSION', 'OVERVIEW', 'INDEX', 'NOTES'];
const SUPPORT_FOLDERS = new Set(['assets', 'attachments', 'images', 'media']);

function stem(name: string): string {
  return name.replace(/\.[^.]+$/u, '').toUpperCase();
}

function anchorFile(files: string[]): string | undefined {
  for (const anchor of ANCHOR_FILES) {
    const match = files.find((name) => stem(name) === anchor);
    if (match) return match;
  }
  return files.find((name) => /\.md$/iu.test(name)) ?? files[0];
}

function topicFolder(folders: string[]): string | undefined {
  return folders.find((name) => !name.startsWith('.') && !SUPPORT_FOLDERS.has(name.toLowerCase()));
}

export function suggestStarters(scopeName: string, outline: AgentScopeOutline): AgentStarter[] {
  if (outline.files.length === 0 && outline.folders.length === 0) return [];
  const starters: AgentStarter[] = [
    // Building a wiki is an ordinary request with no control of its own, so
    // this row is the only place a folder window says the folder can gain one.
    // A starter prefills rather than sends, which keeps the visible request
    // the user's to read and edit before it becomes the one the Agent gets.
    // The label never becomes "Update": the first release claims no built,
    // ready, or stale Wiki state, and one label is how that promise is kept.
    {
      id: 'wiki',
      label: 'Build my wiki',
      prompt: `Build a wiki for ${scopeName}: create or improve the pages that map what's here.`,
    },
    {
      id: 'overview',
      label: `What's in ${scopeName}?`,
      prompt: `Give me an overview of ${scopeName}: what's here, how it's organized, and where to start.`,
    },
  ];
  const folder = topicFolder(outline.folders);
  if (folder) {
    starters.push({
      id: 'folder',
      label: `Summarize ${folder}/`,
      prompt: `Summarize what's in ${folder}/ and what each file covers.`,
    });
  }
  const file = anchorFile(outline.files);
  if (file) {
    starters.push({
      id: 'file',
      label: `What does ${file} say?`,
      prompt: `What does ${file} say? Give me the key points and anything I should act on.`,
    });
  }
  // Three at most. The row sits under the composer, which is the hero, and a
  // fourth chip turns a suggestion into a menu to read. The wiki and the
  // overview always earn their place; the last slot goes to whichever of the
  // folder and the file this scope actually has.
  return starters.slice(0, 3);
}
