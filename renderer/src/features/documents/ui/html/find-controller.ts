import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

const RESPONSE_TIMEOUT_MS = 2_000;

interface PendingRequest {
  resolve(match: FindMatchInfo): void;
  timer: ReturnType<typeof setTimeout>;
}

interface HtmlFrameWindow {
  postMessage(message: unknown, targetOrigin: string): void;
}

function emptyMatch(): FindMatchInfo {
  return { current: 0, total: 0 };
}

function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export interface HtmlFrameFindController extends DocumentFindController {
  accept(message: unknown): boolean;
  dispose(): void;
}

/** Parent half of the deliberately tiny protocol used by an opaque-origin HTML frame. */
export function createHtmlFrameFindController(
  frameWindow: () => HtmlFrameWindow | null,
): HtmlFrameFindController {
  let disposed = false;
  let sequence = 0;
  const pending = new Map<number, PendingRequest>();

  const settle = (requestId: number, match: FindMatchInfo) => {
    const request = pending.get(requestId);
    if (!request) return false;
    clearTimeout(request.timer);
    pending.delete(requestId);
    request.resolve(match);
    return true;
  };

  const send = (
    operation: 'close' | 'next' | 'prev' | 'set',
    extra: Record<string, unknown> = {},
  ): Promise<FindMatchInfo> => {
    if (disposed) return Promise.resolve(emptyMatch());
    const target = frameWindow();
    if (!target) return Promise.resolve(emptyMatch());
    const requestId = ++sequence;
    return new Promise((resolve) => {
      const timer = setTimeout(() => settle(requestId, emptyMatch()), RESPONSE_TIMEOUT_MS);
      pending.set(requestId, { resolve, timer });
      try {
        target.postMessage(
          { ...extra, op: operation, reqId: requestId, type: 'stashbase-find' },
          '*',
        );
      } catch {
        settle(requestId, emptyMatch());
      }
    });
  };

  const query = (value: string, options: FindOptions) =>
    send('set', {
      caseSensitive: options.caseSensitive,
      query: value,
      wholeWord: options.wholeWord,
    });

  return {
    accept(message) {
      if (disposed || !message || typeof message !== 'object') return false;
      const value = message as Record<string, unknown>;
      if (
        value.type !== 'stashbase-find-result' ||
        !validCount(value.reqId) ||
        !validCount(value.current) ||
        !validCount(value.total) ||
        value.current > value.total
      ) {
        return false;
      }
      return settle(value.reqId, { current: value.current, total: value.total });
    },
    close() {
      void send('close');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [requestId] of pending) settle(requestId, emptyMatch());
    },
    next: () => send('next'),
    previous: () => send('prev'),
    restoreQuery: query,
    setQuery: query,
  };
}
