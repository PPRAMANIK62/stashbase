import { describe, expect, it } from 'vite-plus/test';

import type { AgentTabState } from './workspace';
import { createAgentWorkspaceState, removeAgentTab, upsertAgentTab } from './workspace';

function tab(id: string, path: string): AgentTabState {
  return {
    agent: 'stashbase',
    blank: false,
    hasContent: true,
    id,
    lastModified: 1,
    nativeSessionId: `native-${id}`,
    phase: 'live',
    scope: { kind: 'folder', path },
    title: id,
  };
}

describe('Agent workspace domain', () => {
  it('keeps the same state when an upserted tab is unchanged', () => {
    const initial = upsertAgentTab(createAgentWorkspaceState('research'), tab('research', '/L/R'));
    const same = tab('research', '/L/R');
    same.scope = initial.tabs[0]!.scope;
    expect(upsertAgentTab(initial, same)).toBe(initial);
    expect(upsertAgentTab(initial, { ...same, title: 'Renamed' })).not.toBe(initial);
  });

  it('never activates a retained conversation from another folder after removal', () => {
    const initial = createAgentWorkspaceState('plans');
    const withResearch = upsertAgentTab(initial, tab('research', '/Library/Research'));
    const withPlans = upsertAgentTab(withResearch, tab('plans', '/Library/Plans'));

    const removed = removeAgentTab(withPlans, 'plans', {
      kind: 'folder',
      path: '/Library/Plans',
    });

    expect(withPlans.activeId).toBe('plans');
    expect(removed.activeId).toBe('');
    expect(removed.tabs.map((candidate) => candidate.id)).toEqual(['research']);
  });
});
