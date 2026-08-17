/**
 * Public surface of the Agent Panel feature.
 *
 * `ChatPane` and `SessionHistoryMenu` carry the agent runtime and
 * react-aria respectively, which is the whole reason they load at their
 * interaction boundary — the feature owns those boundaries here so a
 * consumer cannot accidentally make either eager. The layout follow-up
 * hook is pure store logic and stays a normal export.
 */
import { lazyWithRetry } from '@/common/components/ErrorBoundary';

export { useChatLayoutFollowUp } from '@/features/agent-panel/hooks/useChatLayoutFollowUp';

export const ChatPane = lazyWithRetry(() =>
  import('@/features/agent-panel/components/ChatPane'));

export const SessionHistoryMenu = lazyWithRetry(() =>
  import('@/features/agent-panel/components/SessionHistoryMenu').then((mod) => ({ default: mod.SessionHistoryMenu })));
