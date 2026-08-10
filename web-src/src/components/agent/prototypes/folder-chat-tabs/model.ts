/**
 * PROTOTYPE — throw away after the folder-switch Chat lifecycle is settled.
 *
 * Question: can folder navigation always present a fresh Agent welcome tab
 * without closing started Chats or accumulating empty tabs? This model tests
 * one replaceable pristine tab that follows navigation while drafted and
 * started tabs remain pinned to the scope where their user work began.
 */

export type ChatScope =
  | { kind: 'library' }
  | { kind: 'folder'; name: string };

export type PrototypeTabState = 'pristine' | 'drafted' | 'started';

export interface PrototypeTab {
  id: number;
  scope: ChatScope;
  state: PrototypeTabState;
}

export interface PrototypeState {
  location: ChatScope;
  tabs: PrototypeTab[];
  activeTabId: number;
  nextTabId: number;
  lastAction: string;
}

export type PrototypeAction =
  | { type: 'navigate'; scope: ChatScope }
  | { type: 'new-chat' }
  | { type: 'draft' }
  | { type: 'clear-draft' }
  | { type: 'start' }
  | { type: 'activate-next' }
  | { type: 'close-active' };

export function scopeLabel(scope: ChatScope): string {
  return scope.kind === 'library' ? 'Library' : scope.name;
}

function sameScope(a: ChatScope, b: ChatScope): boolean {
  return a.kind === b.kind && (a.kind === 'library' || a.name === (b as { kind: 'folder'; name: string }).name);
}

function freshTab(id: number, scope: ChatScope): PrototypeTab {
  return { id, scope, state: 'pristine' };
}

export function initialPrototypeState(): PrototypeState {
  return {
    location: { kind: 'library' },
    tabs: [freshTab(1, { kind: 'library' })],
    activeTabId: 1,
    nextTabId: 2,
    lastAction: 'Opened StashBase at Library',
  };
}

/**
 * Activate one pristine welcome tab for the target scope. Reuse an existing
 * pristine tab wherever possible; drafted or started tabs contain user work
 * and are never rebound.
 */
function welcomeAt(state: PrototypeState, scope: ChatScope, action: string): PrototypeState {
  const active = state.tabs.find((tab) => tab.id === state.activeTabId);
  const reusable = active?.state === 'pristine'
    ? active
    : state.tabs.find((tab) => tab.state === 'pristine');

  if (reusable) {
    return {
      ...state,
      tabs: state.tabs.map((tab) => tab.id === reusable.id ? { ...tab, scope } : tab),
      activeTabId: reusable.id,
      lastAction: `${action}; reused pristine Tab ${reusable.id}`,
    };
  }

  const tab = freshTab(state.nextTabId, scope);
  return {
    ...state,
    tabs: [...state.tabs, tab],
    activeTabId: tab.id,
    nextTabId: state.nextTabId + 1,
    lastAction: `${action}; opened pristine Tab ${tab.id}`,
  };
}

export function reducePrototype(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState {
  const active = state.tabs.find((tab) => tab.id === state.activeTabId);

  switch (action.type) {
    case 'navigate': {
      if (sameScope(state.location, action.scope)) {
        return { ...state, lastAction: `Stayed in ${scopeLabel(action.scope)}; no new Tab` };
      }
      const located = { ...state, location: action.scope };
      return welcomeAt(located, action.scope, `Navigated to ${scopeLabel(action.scope)}`);
    }

    case 'new-chat':
      return welcomeAt(state, state.location, `Requested New Chat in ${scopeLabel(state.location)}`);

    case 'draft':
      if (!active || active.state !== 'pristine') {
        return { ...state, lastAction: 'Draft ignored; active Tab is not pristine' };
      }
      return {
        ...state,
        tabs: state.tabs.map((tab) => tab.id === active.id ? { ...tab, state: 'drafted' } : tab),
        lastAction: `Typed an unsent draft in Tab ${active.id}`,
      };

    case 'clear-draft':
      if (!active || active.state !== 'drafted') {
        return { ...state, lastAction: 'Clear ignored; active Tab has no unsent draft' };
      }
      return {
        ...state,
        tabs: state.tabs.map((tab) => tab.id === active.id ? { ...tab, state: 'pristine' } : tab),
        lastAction: `Cleared the draft in Tab ${active.id}; it is replaceable again`,
      };

    case 'start':
      if (!active || active.state === 'started') {
        return { ...state, lastAction: 'Start ignored; active Chat has already started' };
      }
      return {
        ...state,
        tabs: state.tabs.map((tab) => tab.id === active.id ? { ...tab, state: 'started' } : tab),
        lastAction: `Sent the first message in Tab ${active.id}; its scope is now pinned`,
      };

    case 'activate-next': {
      if (state.tabs.length < 2) return { ...state, lastAction: 'Only one Tab is open' };
      const index = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
      const next = state.tabs[(index + 1) % state.tabs.length];
      return { ...state, activeTabId: next.id, lastAction: `Activated Tab ${next.id}` };
    }

    case 'close-active': {
      if (!active) return state;
      const remaining = state.tabs.filter((tab) => tab.id !== active.id);
      if (remaining.length === 0) {
        const tab = freshTab(state.nextTabId, state.location);
        return {
          ...state,
          tabs: [tab],
          activeTabId: tab.id,
          nextTabId: state.nextTabId + 1,
          lastAction: `Closed Tab ${active.id}; opened a welcome Tab for ${scopeLabel(state.location)}`,
        };
      }
      const next = remaining[Math.min(state.tabs.indexOf(active), remaining.length - 1)];
      return {
        ...state,
        tabs: remaining,
        activeTabId: next.id,
        lastAction: `Closed Tab ${active.id}; activated Tab ${next.id}`,
      };
    }
  }
}
