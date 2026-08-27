import {
  Component,
  lazy,
  type ComponentType,
  type ErrorInfo,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { electronBridge, type ElectronBridge } from '@/common/lib/electronBridge';
import { StatusMessage } from '@/common/components/ui/status';
import { cn } from '@/common/lib/utils';

/** One button recipe for both error surfaces. A SANCTIONED exemption from
 *  the "every button is the `Button` primitive" rule in
 *  `code-review/renderer-styling.md`: this is the recovery path, so it must not
 *  depend on the primitive stack that may have just crashed. Do not
 *  "modernise" it onto `Button` — a crash screen that cannot render is
 *  not a crash screen. The surface half is appended per use (outline vs
 *  primary).
 *
 *  It still owes the user the same press feedback every other button in
 *  the app gives — a control that looks dead is the last thing a crash
 *  screen should offer — so the scale-on-press is duplicated here rather
 *  than imported. */
const ERROR_BUTTON_CLASS =
  'rounded-md border px-2.5 py-1 text-sm font-medium outline-none transition-control focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97';
const ERROR_BUTTON_OUTLINE_CLASS =
  cn(ERROR_BUTTON_CLASS, 'border-border bg-background hover:bg-muted');
const ERROR_BUTTON_PRIMARY_CLASS =
  cn(ERROR_BUTTON_CLASS, 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80');

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

export async function reloadForRecovery(
  bridge: Pick<ElectronBridge, 'reloadWindow'> | undefined = electronBridge(),
  browserReload: () => void = () => window.location.reload(),
): Promise<boolean> {
  if (!bridge?.reloadWindow) {
    browserReload();
    return true;
  }
  try {
    return await bridge.reloadWindow();
  } catch {
    return false;
  }
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
        className={cn(this.props.className, 'flex min-h-18 items-center justify-center gap-2.5')}
      >
        <span>Could not open {this.props.label}.</span>
        <button
          type="button"
          className={ERROR_BUTTON_OUTLINE_CLASS}
          onClick={() => void reloadForRecovery()}
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
 * Recovery still uses a hard renderer reload because a softer state reset can
 * immediately re-trigger the same render failure. In Electron, however, the
 * button delegates to main so a live edit must pass the awaited save barrier;
 * a renderer that has lost that barrier requires an explicit risk warning.
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

  reset = () => { void reloadForRecovery(); };

  /** Stable callback ref (not an inline arrow, which would re-fire per
   *  render): pulls focus onto the crash dialog the moment it mounts, so
   *  keyboard users land on the recovery surface instead of whatever
   *  focused control the crash left behind it. Hand-rolled like the
   *  buttons below — the crash path must not lean on hooks or the
   *  primitive stack that may have just thrown. */
  focusDialog = (node: HTMLDivElement | null) => { node?.focus(); };

  /** Minimal Tab loop keeping `aria-modal` honest: the app behind the veil
   *  is unrecoverable until reload, so Tab must not wander into it. */
  trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button'));
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && (current === first || current === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
      <div className="fixed inset-0 z-modal grid place-items-center bg-veil p-4">
        {/* The card is a dialog, not one big `role="alert"`: wrapping the
          * whole card in an assertive live region made a screen reader
          * read the entire stack trace in one breath. The dialog takes
          * focus on mount and only the short message line stays an alert
          * for the announcement. */}
        <div
          ref={this.focusDialog}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="error-boundary-title"
          tabIndex={-1}
          className="grid max-h-overlay-window w-overlay-xl gap-3 overflow-hidden rounded-xl bg-popover p-5 text-popover-foreground shadow-elevation outline-none"
          onKeyDown={this.trapTab}
        >
          <h1 id="error-boundary-title" className="m-0 text-base font-semibold">Something went wrong</h1>
          <StatusMessage tone="error">{this.state.error.message || 'Unknown error'}</StatusMessage>
          <pre className="max-h-overlay-sm overflow-auto rounded-md bg-pane p-3 text-xs whitespace-pre-wrap">
            {this.state.error.stack ?? '(no stack)'}
          </pre>
          <div className="flex justify-end gap-2">
            <button type="button" className={ERROR_BUTTON_PRIMARY_CLASS} onClick={this.reset}>Reload</button>
            <button type="button" className={ERROR_BUTTON_OUTLINE_CLASS} onClick={() => void this.copyDetails()}>Copy details</button>
          </div>
        </div>
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
