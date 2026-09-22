import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AgentConnection } from '@/features/agent/domain/session';
import { cn } from '@/lib/utils';

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

/** The one line a conversation says about its own connection, above the
 *  composer. A connection with nothing to report renders nothing, so the
 *  caller states only when a notice is allowed at all. */
export function AgentConnectionNotice({
  connection,
  onReconnect,
}: {
  connection: AgentConnection;
  onReconnect(): void;
}) {
  const notice = connectionNotice(connection);
  if (!notice) return null;
  return (
    <div className="mx-auto flex w-full max-w-[46rem] shrink-0 items-center gap-2 px-5 pb-2 text-caption text-muted-foreground max-sm:px-4">
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          notice.settled ? 'bg-decision' : 'bg-working',
        )}
      />
      <span>{notice.text}</span>
      {(connection.kind === 'closed' || connection.kind === 'failed') && (
        <Button
          className="ml-auto"
          leadingIcon={RefreshCw}
          onClick={onReconnect}
          size="compact"
          variant="ghost"
        >
          Reconnect
        </Button>
      )}
    </div>
  );
}
