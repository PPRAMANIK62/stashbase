/**
 * Regression guard for the context split (see the slice map atop
 * `state.ts`): a dispatch that only touches one slice's fields must not
 * change the OTHER slices' context value identity. Without this, a future
 * edit to `WorkspaceProvider` / `ChatProvider` / `UiShellProvider` could
 * silently widen its `useMemo` deps (or drop them) and quietly reintroduce
 * the whole-tree re-render problem this split exists to fix.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act, create } from 'react-test-renderer';
import { initialState, reducer, type Action } from '../state/state.ts';
import { WorkspaceProvider, useWorkspace, type WorkspaceState } from '../contexts/WorkspaceContext.tsx';
import { ChatProvider, useChat, type ChatState } from '../contexts/ChatContext.tsx';
import { UiShellProvider, useUiShell, type UiShellState } from '../contexts/UiShellContext.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Capture({ onRender }: { onRender: (v: { workspace: WorkspaceState; chat: ChatState; uiShell: UiShellState }) => void }) {
  const workspace = useWorkspace();
  const chat = useChat();
  const uiShell = useUiShell();
  onRender({ workspace, chat, uiShell });
  return null;
}

test('a ui-shell-only dispatch leaves the workspace and chat context values unchanged', async () => {
  let dispatch!: (a: Action) => void;
  const seen: { workspace: WorkspaceState; chat: ChatState; uiShell: UiShellState }[] = [];

  function Harness() {
    const [state, d] = React.useReducer(reducer, initialState);
    dispatch = d;
    return React.createElement(
      WorkspaceProvider,
      {
        state,
        children: React.createElement(
          ChatProvider,
          {
            state,
            children: React.createElement(
              UiShellProvider,
              { state, children: React.createElement(Capture, { onRender: (v) => seen.push(v) }) },
            ),
          },
        ),
      },
    );
  }

  await act(async () => {
    create(React.createElement(Harness));
  });
  assert.equal(seen.length, 1);
  const before = seen[0];

  await act(async () => {
    dispatch({ type: 'MODAL_OPEN', request: { type: 'alert', message: 'hi' } });
  });
  assert.equal(seen.length, 2);
  const afterModal = seen[1];
  assert.equal(afterModal.workspace, before.workspace, 'workspace slice must not change identity for a ui-shell-only dispatch');
  assert.equal(afterModal.chat, before.chat, 'chat slice must not change identity for a ui-shell-only dispatch');
  assert.notEqual(afterModal.uiShell, before.uiShell, 'ui-shell slice must change for its own dispatch');

  await act(async () => {
    dispatch({ type: 'SIDEBAR_WIDTH', width: 260 });
  });
  assert.equal(seen.length, 3);
  const afterSidebar = seen[2];
  assert.notEqual(afterSidebar.workspace, afterModal.workspace, 'workspace slice must change for its own dispatch');
  assert.equal(afterSidebar.chat, afterModal.chat, 'chat slice must not change identity for a workspace-only dispatch');
  assert.equal(afterSidebar.uiShell, afterModal.uiShell, 'ui-shell slice must not change identity for a workspace-only dispatch');

  await act(async () => {
    dispatch({ type: 'CHAT_TOGGLE' });
  });
  assert.equal(seen.length, 4);
  const afterChat = seen[3];
  assert.equal(afterChat.workspace, afterSidebar.workspace, 'workspace slice must not change identity for a chat-only dispatch');
  assert.notEqual(afterChat.chat, afterSidebar.chat, 'chat slice must change for its own dispatch');
  assert.equal(afterChat.uiShell, afterSidebar.uiShell, 'ui-shell slice must not change identity for a chat-only dispatch');
});
