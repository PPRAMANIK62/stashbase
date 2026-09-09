/**
 * The open-document tab strip.
 *
 * The runtime is the real one built over the document fixtures, so a tab's
 * name, its format icon and its unsaved marker all come from the document
 * behind it rather than from props invented for the picture.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo } from 'react';

import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { documentQueryScope, sourceApi, textSource } from '@/test/fakes/documents';

import { DocumentTabs } from './tabs';

const FOLDER_PATH = '/library/notes';

const RESTORED = {
  activeTabId: 'tab-1',
  tabs: [
    { id: 'tab-1', source: { folderPath: FOLDER_PATH, path: 'plan.md' } },
    { id: 'tab-2', source: { folderPath: FOLDER_PATH, path: 'drafts/outline.md' } },
    { id: 'tab-3', source: { folderPath: FOLDER_PATH, path: 'data/index.json' } },
  ],
};

function TabsPreview({ unsaved = false }: { unsaved?: boolean }) {
  const runtime = useMemo(() => {
    const next = createDocumentTabsRuntime({
      api: sourceApi(),
      createId: () => 'tab-new',
      createQueries: () => documentQueryScope(),
      folderPath: FOLDER_PATH,
      generation: 1,
      restored: RESTORED,
    });
    // The editor arrives from a settled load in the product; here it is
    // reconciled directly so the strip can be pinned mid-edit.
    for (const tab of RESTORED.tabs) {
      next.getDocument(tab.id)?.reconcile(textSource({ content: '# Plan' }));
    }
    if (unsaved) next.getDocument('tab-1')?.change('# Plan\n\nA line nobody has saved yet.');
    return next;
  }, [unsaved]);

  useEffect(() => () => runtime.dispose(), [runtime]);

  return (
    <div className="w-full border-b border-border">
      <DocumentTabs runtime={runtime} />
    </div>
  );
}

const meta = {
  component: TabsPreview,
  parameters: {
    controls: { disable: true },
    fluidCanvas: { minHeight: '6rem', width: '34rem' },
  },
  title: 'Compositions/Document tabs',
} satisfies Meta<typeof TabsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three saved documents, the active one selected, each closable. */
export const OpenDocuments: Story = {};

/** The active document has unsaved text: its close affordance becomes the
 *  unsaved dot, and its accessible name says so. */
export const UnsavedDocument: Story = {
  args: { unsaved: true },
};
