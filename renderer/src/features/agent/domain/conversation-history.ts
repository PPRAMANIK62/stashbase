import { agentScopesEqual, type AgentId, type AgentScope } from './session';
import type { AgentTabState } from './workspace';

export interface AgentHistoryEntry {
  agent: AgentId;
  hasContent: boolean;
  id: string;
  lastModified: number;
  scope: AgentScope;
  title: string;
}

export interface AgentConversationItem {
  active: boolean;
  agent: AgentId;
  entry?: AgentHistoryEntry;
  id: string;
  lastModified: number;
  tabId?: string;
  title: string;
}

export interface AgentConversationGroup {
  id: string;
  items: AgentConversationItem[];
  label: string;
}

function startOfLocalDay(value: number): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function dateGroupLabel(day: Date, today: Date): string {
  if (day.getTime() === today.getTime()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return day.toLocaleDateString(
    [],
    day.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' },
  );
}

export function buildConversationGroups(options: {
  activeId: string;
  history: readonly AgentHistoryEntry[];
  now?: number;
  scope: AgentScope;
  tabs: readonly AgentTabState[];
}): AgentConversationGroup[] {
  const openByNativeId = new Map<string, AgentTabState>();
  const visibleTabs = options.tabs.filter(
    (tab) => tab.hasContent && agentScopesEqual(tab.scope, options.scope),
  );
  for (const tab of visibleTabs) {
    if (tab.nativeSessionId) openByNativeId.set(`${tab.agent}:${tab.nativeSessionId}`, tab);
  }

  const representedTabs = new Set<string>();
  const conversations: AgentConversationItem[] = options.history
    .filter((entry) => entry.hasContent && agentScopesEqual(entry.scope, options.scope))
    .map((entry) => {
      const tab = openByNativeId.get(`${entry.agent}:${entry.id}`);
      if (tab) representedTabs.add(tab.id);
      const conversation: AgentConversationItem = {
        active: tab?.id === options.activeId,
        agent: entry.agent,
        entry,
        id: `${entry.agent}:${entry.id}`,
        lastModified: Math.max(entry.lastModified, tab?.lastModified ?? 0),
        title: (tab?.title ?? entry.title).trim() || 'Untitled',
      };
      if (tab) conversation.tabId = tab.id;
      return conversation;
    });

  for (const tab of visibleTabs) {
    if (representedTabs.has(tab.id)) continue;
    conversations.push({
      active: tab.id === options.activeId,
      agent: tab.agent,
      id: `local:${tab.id}`,
      lastModified: tab.lastModified,
      tabId: tab.id,
      title: tab.title.trim() || 'Untitled',
    });
  }

  conversations.sort((left, right) => right.lastModified - left.lastModified);
  const today = startOfLocalDay(options.now ?? Date.now());
  const groups = new Map<number, AgentConversationGroup>();
  for (const conversation of conversations) {
    const day = startOfLocalDay(conversation.lastModified);
    const key = day.getTime();
    const existing = groups.get(key);
    if (existing) existing.items.push(conversation);
    else {
      groups.set(key, {
        id: String(key),
        items: [conversation],
        label: dateGroupLabel(day, today),
      });
    }
  }
  return [...groups.values()];
}
