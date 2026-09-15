import type { AgentConnection } from '@/features/agent/domain/session';

export function connectionNotice(
  connection: AgentConnection,
): { settled: boolean; text: string } | null {
  switch (connection.kind) {
    case 'draft':
    case 'restoring':
    case 'connecting':
    case 'reconnecting':
    case 'live':
      return null;
    case 'closed':
      return { settled: true, text: connection.message ?? 'Disconnected' };
    case 'failed':
      return { settled: true, text: connection.message };
    case 'retired':
      return { settled: true, text: 'Folder removed · transcript preserved' };
    case 'disposed':
      return { settled: true, text: 'Conversation closed' };
    default: {
      const unreachable: never = connection;
      return unreachable;
    }
  }
}
