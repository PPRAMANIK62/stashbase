import { describe, expect, it } from 'vite-plus/test';

import { buildConversationGroups, type AgentHistoryEntry } from './conversation-history';

describe('Agent conversation history', () => {
  it('projects one scoped newest-first tree and merges mounted native sessions', () => {
    const scope = { kind: 'folder' as const, path: '/Library/Research' };
    const today = new Date(2026, 8, 8, 12).getTime();
    const history: AgentHistoryEntry[] = [
      {
        agent: 'codex',
        hasContent: true,
        id: 'older',
        lastModified: today - 2_000,
        scope,
        title: 'Server title',
      },
      {
        agent: 'codex',
        hasContent: false,
        id: 'empty',
        lastModified: today + 1_000,
        scope,
        title: 'New Chat',
      },
      {
        agent: 'claude',
        hasContent: true,
        id: 'other-folder',
        lastModified: today + 2_000,
        scope: { kind: 'folder', path: '/Library/Plans' },
        title: 'Plans',
      },
    ];

    const groups = buildConversationGroups({
      activeId: 'tab-1',
      history,
      now: today,
      scope,
      tabs: [
        {
          agent: 'codex',
          blank: false,
          hasContent: true,
          id: 'tab-1',
          lastModified: today,
          nativeSessionId: 'older',
          phase: 'live',
          scope,
          title: 'Mounted title',
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Today');
    expect(groups[0]?.items).toMatchObject([
      {
        active: true,
        id: 'codex:older',
        lastModified: today,
        tabId: 'tab-1',
        title: 'Mounted title',
      },
    ]);
  });
});
