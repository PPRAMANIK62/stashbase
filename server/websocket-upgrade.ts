import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

export type WebSocketUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => void;

/** One canonical Agent endpoint. Vite owns only the root HMR socket, so a
 * retired or misspelled Agent route cannot fall through to another owner. */
export function createWebSocketUpgradeHandler({
  allowedOrigins,
  agentUpgrade,
  viteUpgrade,
}: {
  allowedOrigins: ReadonlySet<string>;
  agentUpgrade: WebSocketUpgrade;
  viteUpgrade?: WebSocketUpgrade;
}): WebSocketUpgrade {
  return (request, socket, head) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      socket.destroy();
      return;
    }
    const pathname = (request.url ?? '').split('?')[0];
    if (pathname === '/ws/agent') {
      agentUpgrade(request, socket, head);
    } else if (pathname === '/' && viteUpgrade) {
      viteUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  };
}
