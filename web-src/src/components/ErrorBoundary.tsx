import {
  Component,
  lazy,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { StatusMessage } from './ui/status';

/** One button recipe for both error surfaces. Hand-rolled on purpose:
 *  this is the recovery path, so it must not depend on the primitive
 *  stack that may have just crashed. The surface half is appended per
 *  use (outline vs primary). */
const ERROR_BUTTON_CLASS =
  'rounded-md border px-2.5 py-1 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
const ERROR_BUTTON_OUTLINE_CLASS =
  `${ERROR_BUTTON_CLASS} border-border bg-background hover:bg-muted`;
const ERROR_BUTTON_PRIMARY_CLASS =
  `${ERROR_BUTTON_CLASS} border-transparent bg-primary text-primary-foreground hover:bg-primary/80`;

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

interface LazyLoadBoundaryProps {
  children: ReactNode;
  className: string;
  label: string;
  resetKey?: string;
}

interface LazyLoadBoundaryState {
  error: Error | null;
  resetKey?: string;
}

export async function loadWithRetry<T>(
  loader: () => Promise<T>,
  retries = 1,
  delayMs = 250,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error: unknown) {
      lastError = error;
      if (attempt < retries && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) {
  return lazy(() => loadWithRetry(loader));
}

export class LazyLoadBoundary extends Component<LazyLoadBoundaryProps, LazyLoadBoundaryState> {
  constructor(props: LazyLoadBoundaryProps) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromProps(
    props: LazyLoadBoundaryProps,
    state: LazyLoadBoundaryState,
  ): LazyLoadBoundaryState | null {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Pick<LazyLoadBoundaryState, 'error'> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <StatusMessage
        tone="error"
        className={`${this.props.className} flex min-h-18 items-center justify-center gap-2.5`}
      >
        <span>Could not open {this.props.label}.</span>
        <button
          type="button"
          className={ERROR_BUTTON_OUTLINE_CLASS}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </StatusMessage>
    );
  }
}

/**
 * Root-level error boundary. Without this, any render-time exception
 * anywhere in the tree blanks the whole renderer — the user sees a
 * white window with no recovery path. With it, we trap the error,
 * render a recovery surface (reload button + error text + copyable
 * stack trace), and POST the stack to the server log so the failure
 * shows up alongside other server-side issues for debugging.
 *
 * Reload uses `window.location.reload()` because the renderer state
 * may be in an inconsistent shape — a softer "reset state and try
 * again" risks re-triggering the same crash on the next render. The
 * SAVE_STATUS / activeTab buffer is already persisted (autosave runs
 * on every edit + a `beforeunload` `sendBeacon`), so a hard reload
 * loses at most the cursor position in the current tab.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    reportClientError(error, info);
  }

  reset = () => window.location.reload();

  copyDetails = async () => {
    if (!this.state.error) return;
    const details = [
      `Error: ${this.state.error.message}`,
      '',
      'Stack:',
      this.state.error.stack ?? '(no stack)',
      '',
      'Component stack:',
      this.state.componentStack ?? '(no component stack)',
    ].join('\n');
    try { await navigator.clipboard.writeText(details); } catch { /* clipboard denied */ }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 z-[10000] grid place-items-center bg-veil p-4">
        <StatusMessage
          tone="error"
          className="grid max-h-[calc(100vh-32px)] w-[min(620px,calc(100vw-32px))] gap-3 overflow-hidden rounded-xl bg-popover p-5 text-popover-foreground shadow-elevation"
        >
          <h1 className="m-0 text-base font-semibold">Something went wrong</h1>
          <div>{this.state.error.message || 'Unknown error'}</div>
          <pre className="max-h-[min(48vh,360px)] overflow-auto rounded-md bg-pane p-3 text-xs whitespace-pre-wrap">
            {this.state.error.stack ?? '(no stack)'}
          </pre>
          <div className="flex justify-end gap-2">
            <button type="button" className={ERROR_BUTTON_PRIMARY_CLASS} onClick={this.reset}>Reload</button>
            <button type="button" className={ERROR_BUTTON_OUTLINE_CLASS} onClick={() => void this.copyDetails()}>Copy details</button>
          </div>
        </StatusMessage>
      </div>
    );
  }
}

function reportClientError(error: Error, info: ErrorInfo): void {
  // Fire-and-forget so a logging failure never masks the renderer error.
  void fetch('/api/log/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      at: new Date().toISOString(),
    }),
  }).catch(() => { /* swallow */ });
}
