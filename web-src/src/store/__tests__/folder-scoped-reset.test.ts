import assert from 'node:assert/strict';
import test from 'node:test';
import { folderScopedResetActions } from '@/store/lib/folderScopedReset';
import { reducer } from '@/store/state/stateReducer';
import { initialState, type State } from '@/store/state/state';

function stateWithChatTabs(): State {
  return {
    ...initialState,
    chatOpen: true,
    chatTabs: [
      { id: 'tab-claude', agent: 'claude', title: 'Research notes' },
      { id: 'tab-codex', agent: 'codex', title: 'New Chat' },
    ],
    activeChatTabId: 'tab-claude',
    chatTabRecencyByAgent: { claude: ['tab-claude'], codex: ['tab-codex'] },
  };
}

function applyAll(state: State, actions: ReturnType<typeof folderScopedResetActions>): State {
  return actions.reduce((current, action) => reducer(current, action), state);
}

test('chat tabs and their sessions survive a window folder switch', () => {
  const plan = folderScopedResetActions('switch');
  assert.equal(plan.some((action) => action.type === 'CHAT_TABS_RESET'), false);
  // Document tabs still reset on a switch — only chat state survives.
  assert.equal(plan.some((action) => action.type === 'TABS_RESET'), true);

  const after = applyAll(stateWithChatTabs(), plan);
  assert.deepEqual(after.chatTabs.map((tab) => tab.id), ['tab-claude', 'tab-codex']);
  assert.equal(after.activeChatTabId, 'tab-claude');
  assert.equal(after.chatOpen, true);
});

test('losing the window folder context still resets chat tabs', () => {
  const plan = folderScopedResetActions('folder-lost');
  assert.equal(plan.some((action) => action.type === 'CHAT_TABS_RESET'), true);

  const after = applyAll(stateWithChatTabs(), plan);
  assert.deepEqual(after.chatTabs, []);
  assert.equal(after.activeChatTabId, null);
  assert.equal(after.chatOpen, false);
});

test('both transitions clear the same folder-scoped preparation state', () => {
  const switchTypes = folderScopedResetActions('switch').map((action) => action.type);
  const lostTypes = folderScopedResetActions('folder-lost').map((action) => action.type);
  assert.deepEqual(
    lostTypes.filter((type) => type !== 'CHAT_TABS_RESET'),
    switchTypes,
  );
});
