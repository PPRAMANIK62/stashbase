import assert from 'node:assert/strict';
import test from 'node:test';

import {
  workspaceSessionReadResponseSchema,
  workspaceSessionSnapshotSchema,
} from './workspace-session.ts';

const current = {
  activeFolderPath: '/workspace/notes',
  folders: [
    {
      activeTabId: 'tab-1',
      expandedPaths: ['drafts'],
      folderPath: '/workspace/notes',
      selectedPath: 'drafts/plan.md',
      tabs: [{ id: 'tab-1', path: 'drafts/plan.md' }],
    },
  ],
  shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 288 },
  version: 1,
} as const;

test('workspace session protocol accepts only the bounded v1 allowlist', () => {
  assert.deepEqual(workspaceSessionSnapshotSchema.parse(current), current);
  assert.equal(
    workspaceSessionSnapshotSchema.safeParse({
      ...current,
      queryCache: [{ private: true }],
    }).success,
    false,
  );
  assert.equal(
    workspaceSessionSnapshotSchema.safeParse({
      ...current,
      shell: { sidebarOpen: true, sidebarWidth: 900 },
    }).success,
    false,
  );
  const spacedPath = {
    ...current,
    folders: [{ ...current.folders[0], selectedPath: ' notes /plan.md ' }],
  };
  assert.equal(
    workspaceSessionSnapshotSchema.parse(spacedPath).folders[0].selectedPath,
    ' notes /plan.md ',
  );
  assert.equal(
    workspaceSessionSnapshotSchema.safeParse({
      ...current,
      folders: [
        {
          ...current.folders[0],
          expandedPaths: Array.from({ length: 300 }, (_, index) =>
            `${index}-${'x'.repeat(4090)}`,
          ),
        },
      ],
    }).success,
    false,
  );
});

test('workspace session read responses reject unsupported persisted versions', () => {
  assert.equal(
    workspaceSessionReadResponseSchema.safeParse({ ok: true, session: current }).success,
    true,
  );
  assert.equal(
    workspaceSessionReadResponseSchema.safeParse({
      ok: true,
      session: { ...current, version: 2 },
    }).success,
    false,
  );
});
