import {
  errorFromUnknown,
  rpcError,
  type JsonObject,
  type JsonRpcId,
} from './codex-protocol.ts';

export const CODEX_RPC_REQUEST_TIMEOUT_MS = 30000;

export class CodexRpcRequestTimeoutError extends Error {
  constructor(readonly method: string) {
    super(`Codex app-server request timed out: ${method}`);
    this.name = 'CodexRpcRequestTimeoutError';
  }
}

interface PendingRpc {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}
export interface CodexRpcPeerOptions {
  requestTimeoutMs?: number;
  scheduleTimeout?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  cancelTimeout?: (timer: ReturnType<typeof setTimeout>) => void;
  onRequest?: (message: { id: JsonRpcId; method: string; params: JsonObject }) => void;
  onNotification?: (method: string, params: JsonObject) => void;
}

/** JSON-RPC correlation and dispatch over an injected line writer. */
export class CodexRpcPeer {
  private nextRequestId = 1;
  private pending = new Map<JsonRpcId, PendingRpc>();
  private closed = false;

  constructor(
    private writeLine: (line: string) => void,
    private options: CodexRpcPeerOptions = {},
  ) {}

  request(method: string, params: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error('Codex app-server is not running.'));
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const pending: PendingRpc = { resolve, reject };
      const timeoutMs = this.options.requestTimeoutMs ?? 0;
      if (timeoutMs > 0) {
        const scheduleTimeout = this.options.scheduleTimeout ?? setTimeout;
        pending.timer = scheduleTimeout(() => {
          pending.timer = undefined;
          this.pending.delete(id);
          reject(new CodexRpcRequestTimeoutError(method));
        }, timeoutMs);
        pending.timer.unref?.();
      }
      this.pending.set(id, pending);
      try {
        this.writeLine(JSON.stringify({ id, method, params }));
      } catch (err: unknown) {
        this.pending.delete(id);
        this.clearPendingTimer(pending);
        reject(errorFromUnknown(err));
      }
    });
  }

  respond(id: JsonRpcId, result: unknown): void {
    if (this.closed) return;
    this.writeLine(JSON.stringify({ id, result }));
  }

  reject(id: JsonRpcId, message: string, code = -32603): void {
    if (this.closed) return;
    this.writeLine(JSON.stringify({ id, error: { code, message } }));
  }

  receiveLine(line: string): void {
    if (this.closed) return;
    let message: JsonObject;
    try {
      message = JSON.parse(line) as JsonObject;
    } catch {
      return;
    }

    if ('id' in message && ('result' in message || 'error' in message) && !('method' in message)) {
      this.receiveResponse(message);
      return;
    }
    if (typeof message.method !== 'string') return;
    const params = message.params && typeof message.params === 'object'
      ? message.params as JsonObject
      : {};
    if ('id' in message) {
      this.options.onRequest?.({
        id: message.id as JsonRpcId,
        method: message.method,
        params,
      });
    } else {
      this.options.onNotification?.(message.method, params);
    }
  }

  close(error = new Error('Codex app-server connection closed.')): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, pending] of this.pending) {
      this.clearPendingTimer(pending);
      pending.reject(error);
    }
    this.pending.clear();
  }

  isClosed(): boolean {
    return this.closed;
  }

  private receiveResponse(message: JsonObject): void {
    const id = message.id as JsonRpcId;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    this.clearPendingTimer(pending);
    if ('error' in message) pending.reject(rpcError(message.error));
    else pending.resolve(message.result);
  }

  private clearPendingTimer(pending: PendingRpc): void {
    if (!pending.timer) return;
    const cancelTimeout = this.options.cancelTimeout ?? clearTimeout;
    cancelTimeout(pending.timer);
    pending.timer = undefined;
  }
}
