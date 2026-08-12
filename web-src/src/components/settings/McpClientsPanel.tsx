/**
 * Settings → MCP panel. Three clients auto-connect (StashBase writes their
 * config file); every other client just gets the standard MCP config shown
 * inline below, with their names listed for reference.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type McpHttpStatus } from '../../api';
import { MCP_CLIENTS, mcpClientLabel, type McpClientId } from '../../agentCatalog';
import { CopyIcon, CheckIcon } from '../../icons';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { StatusMessage } from '../ui/status';

interface McpConfigureResult {
  client?: McpClientId;
  file?: string;
  command?: string;
}

type McpClientStatus = {
  configured: boolean;
  cliInstalled?: boolean;
  restartRequired?: boolean;
};

export function McpClientsPanel() {
  const mountedRef = useRef(true);
  const copyResetTimerRef = useRef<number | null>(null);
  const [busy, setBusy] = useState<McpClientId | null>(null);
  const [clientStatus, setClientStatus] = useState<Record<string, McpClientStatus>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [config, setConfig] = useState<string>('');
  const [copied, setCopied] = useState<'stdio' | 'loopback' | 'token' | 'docker' | null>(null);
  const [http, setHttp] = useState<McpHttpStatus | null>(null);
  const [httpBusy, setHttpBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [dockerPortInput, setDockerPortInput] = useState('');

  useEffect(() => () => {
    mountedRef.current = false;
    if (copyResetTimerRef.current != null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  const loadStatus = useCallback(async (opts: { silent?: boolean } = {}) => {
    try {
      const res = await api.mcpStatus();
      if (!mountedRef.current) return;
      setClientStatus(normalizeClientStatuses(res.clients));
      setConfig(JSON.stringify(res.config ?? {}, null, 2));
      setHttp(res.http);
      setDockerPortInput(String(res.http.dockerPort));
    } catch (err: unknown) {
      if (!mountedRef.current || opts.silent) return;
      const text = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', text });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadStatus({ silent: true });
  }, [loadStatus]);

  // The app listener starts immediately after the loopback web server. A
  // Settings request can land during that short transition, so refresh until
  // the opted-in Docker listener reaches a terminal active/error state.
  useEffect(() => {
    if (!http?.dockerAccess || http.dockerActive || http.dockerError || http.settingsError) return;
    const timer = window.setInterval(() => void loadStatus({ silent: true }), 750);
    return () => window.clearInterval(timer);
  }, [http?.dockerAccess, http?.dockerActive, http?.dockerError, http?.settingsError, loadStatus]);

  async function connect(client: McpClientId) {
    setBusy(client);
    setStatus(null);
    try {
      const result = await api.configureMcp(client) as McpConfigureResult;
      if (!mountedRef.current) return;
      const file = result.file ? ` (${result.file})` : '';
      setClientStatus((next) => ({
        ...next,
        [client]: {
          ...(next[client] ?? { configured: false }),
          configured: true,
        },
      }));
      setStatus({ kind: 'ok', text: `Connected ${mcpClientLabel(client)}${file}.` });
      void loadStatus({ silent: true });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const text = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', text });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function disconnect(client: McpClientId) {
    setBusy(client);
    setStatus(null);
    try {
      const result = await api.disconnectMcp(client) as McpConfigureResult;
      if (!mountedRef.current) return;
      const file = result.file ? ` (${result.file})` : '';
      setClientStatus((next) => ({
        ...next,
        [client]: {
          ...(next[client] ?? { configured: true }),
          configured: false,
          restartRequired: false,
        },
      }));
      setStatus({ kind: 'ok', text: `Disconnected ${mcpClientLabel(client)}${file}.` });
      void loadStatus({ silent: true });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const text = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', text });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function copyText(value: string, target: 'stdio' | 'loopback' | 'token' | 'docker') {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      // navigator.clipboard can reject in an unfocused / restricted
      // Electron webview — fall back to the legacy execCommand path.
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) {
      if (!mountedRef.current) return;
      setCopied(target);
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        copyResetTimerRef.current = null;
        if (mountedRef.current) setCopied(null);
      }, 1500);
    } else {
      if (!mountedRef.current) return;
      setStatus({ kind: 'error', text: 'Couldn’t copy — select the text and copy manually.' });
    }
  }

  async function rotateToken() {
    if (!window.confirm('Rotate the MCP bearer token? URL-based clients using the current token will stop working.')) return;
    setHttpBusy(true);
    setStatus(null);
    try {
      const result = await api.rotateMcpHttpToken();
      if (!mountedRef.current) return;
      setHttp(result.http);
      setStatus({ kind: 'ok', text: 'MCP bearer token rotated. Update every URL-based client.' });
    } catch (err: unknown) {
      if (mountedRef.current) setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      if (mountedRef.current) setHttpBusy(false);
    }
  }

  async function setDockerAccess(enabled: boolean) {
    setHttpBusy(true);
    setStatus(null);
    try {
      const result = await api.setMcpDockerAccess(enabled);
      if (!mountedRef.current) return;
      setHttp(result.http);
      setStatus({
        kind: 'ok',
        text: enabled ? 'Docker MCP access enabled.' : 'Docker MCP access disabled.',
      });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
      void loadStatus({ silent: true });
    } finally {
      if (mountedRef.current) setHttpBusy(false);
    }
  }

  async function saveDockerPort() {
    const port = Number(dockerPortInput);
    if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
      setStatus({ kind: 'error', text: 'Docker MCP port must be an integer from 1024 to 65535.' });
      return;
    }
    setHttpBusy(true);
    setStatus(null);
    try {
      const result = await api.setMcpDockerPort(port);
      if (!mountedRef.current) return;
      setHttp(result.http);
      setDockerPortInput(String(result.http.dockerPort));
      setStatus({ kind: 'ok', text: `Docker MCP port changed to ${result.http.dockerPort}.` });
    } catch (err: unknown) {
      if (mountedRef.current) setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      if (mountedRef.current) setHttpBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-1 text-base font-semibold">MCP clients</div>
      <div className="mb-2.5 text-sm leading-normal text-muted-foreground">
        Connect StashBase to your agents. Restart each app after connecting.
      </div>
      <div className="flex max-h-[min(56vh,620px)] flex-col overflow-y-auto rounded-lg border border-border bg-background">
        {MCP_CLIENTS.map((client) => {
          const status = clientStatus[client.id] ?? { configured: false };
          const badge = clientBadge(client, status);
          const isConnected = status.configured;
          const isBusy = busy === client.id;
          const Icon = client.Icon;
          return (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0" key={client.id}>
              <span className="inline-flex min-w-0 items-center gap-2.5">
                <span className="inline-grid size-7 flex-none place-items-center rounded-md border border-border bg-pane text-foreground [&_svg]:size-4">
                  <Icon />
                </span>
                <span className="flex min-w-0 items-center">
                  <span className="truncate text-base font-semibold text-foreground">{client.name}</span>
                </span>
              </span>
              {badge && (
                <span
                  className={
                    'inline-flex h-6 min-w-[98px] items-center justify-center rounded-full border px-2.25 text-xs font-medium whitespace-nowrap '
                    + (badge.tone === 'warn'
                      ? 'border-status-danger/30 bg-status-danger/5 text-destructive'
                      : 'border-status-warning/25 bg-status-warning/10 text-status-warning')
                  }
                  title={badge.title}
                >
                  {badge.label}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={
                  'min-w-24 flex-none '
                  + (isConnected
                    ? 'border-accent/30 bg-accent/10 text-accent hover:border-destructive/45 hover:bg-destructive/5 hover:text-destructive'
                    : 'hover:border-accent/30 hover:bg-accent/10 hover:text-accent')
                }
                disabled={busy != null}
                onClick={() => void (isConnected ? disconnect(client.id) : connect(client.id))}
                title={isConnected ? `Disconnect ${client.name}` : `Connect ${client.name}`}
              >
                {isBusy
                  ? (isConnected ? 'Disconnecting…' : 'Connecting…')
                  : isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          );
        })}
      </div>
      {status && (
        <StatusMessage tone={status.kind === 'error' ? 'error' : 'success'} className="mt-2.5 wrap-anywhere">
          {status.text}
        </StatusMessage>
      )}

      <div className="mt-4.5 border-t border-border pt-4.5">
        <div className="mb-1 text-base font-semibold">URL access</div>
        <div className="mb-2.5 text-sm leading-normal text-muted-foreground">
          For server-side MCP clients that cannot launch the local command. Browser pages are not supported.
        </div>
        {http ? (
          <>
            {http.settingsError && (
              <div className="text-sm text-destructive">
                URL access settings are unavailable: {http.settingsError}
              </div>
            )}
            <McpHttpField
              label="Local URL"
              value={http.loopbackUrl}
              copied={copied === 'loopback'}
              onCopy={() => void copyText(http.loopbackUrl, 'loopback')}
            />
            <div className="mt-2.5 flex flex-col gap-1">
              <label htmlFor="mcp-http-token" className="text-xs font-semibold text-muted-foreground">Bearer token</label>
              <div className="flex min-w-0 items-center gap-1.5">
                <Input
                  id="mcp-http-token"
                  className="flex-1 font-mono text-sm"
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  spellCheck={false}
                  value={http.token ?? ''}
                  placeholder={http.settingsError ? 'Unavailable' : undefined}
                />
                <Button variant="outline" size="sm" disabled={!http.token} onClick={() => setShowToken((shown) => !shown)}>
                  {showToken ? 'Hide' : 'Show'}
                </Button>
                <CopyButton
                  copied={copied === 'token'}
                  disabled={!http.token}
                  onCopy={() => http.token && void copyText(http.token, 'token')}
                  label="token"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" disabled={httpBusy || !http.token} onClick={() => void rotateToken()}>
                Rotate token…
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={http.dockerAccess}
                  disabled={httpBusy || !!http.settingsError}
                  onChange={(event) => void setDockerAccess(event.target.checked)}
                />
                <span>Enable Docker access</span>
              </label>
            </div>
            <div className="mt-2.5 flex flex-col gap-1">
              <label htmlFor="mcp-http-docker-port" className="text-xs font-semibold text-muted-foreground">Docker port</label>
              <div className="flex min-w-0 items-center gap-1.5">
                <Input
                  id="mcp-http-docker-port"
                  className="flex-1 font-mono text-sm"
                  type="number"
                  min={1024}
                  max={65535}
                  step={1}
                  value={dockerPortInput}
                  disabled={httpBusy || http.dockerAccess || !!http.settingsError}
                  onChange={(event) => setDockerPortInput(event.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={httpBusy || http.dockerAccess || !!http.settingsError || dockerPortInput === String(http.dockerPort)}
                  onClick={() => void saveDockerPort()}
                >
                  Save port
                </Button>
              </div>
            </div>
            <div className="mt-3.5 text-sm leading-normal text-muted-foreground">
              Disabled by default. Enabling opens a separate token-gated MCP-only port on host interfaces; no other StashBase API is exposed. Disable access before changing the port. Docker Desktop or the host firewall must allow that port.
            </div>
            {http.dockerAccess && (
              <>
                <McpHttpField
                  label="Docker URL"
                  value={http.dockerUrl}
                  copied={copied === 'docker'}
                  onCopy={() => void copyText(http.dockerUrl, 'docker')}
                />
                <div className={http.dockerActive ? 'text-sm text-status-success' : 'text-sm text-destructive'}>
                  {http.dockerActive
                    ? 'Docker listener is active.'
                    : `Docker listener is not active${http.dockerError ? `: ${http.dockerError}` : '.'}`}
                </div>
                <div className="mt-3.5 text-sm leading-normal text-muted-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:whitespace-nowrap [&_code]:text-accent">
                  Native Linux Docker Engine also needs <code>--add-host=host.docker.internal:host-gateway</code> or the equivalent Compose <code>extra_hosts</code> entry.
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Loading URL access…</div>
        )}
      </div>

      <div className="mt-4.5 flex flex-col gap-2.5">
        <div className="mb-2.5 text-sm leading-normal text-muted-foreground">
          For any other MCP-compatible agent, paste this configuration into its MCP settings:
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-muted">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            MCP configuration
            <CopyButton
              copied={copied === 'stdio'}
              onCopy={() => void copyText(config, 'stdio')}
              label="configuration"
            />
          </div>
          <pre className="m-0 max-h-80 overflow-auto p-3 font-mono text-xs whitespace-pre text-foreground">{config}</pre>
        </div>
      </div>
    </div>
  );
}

function McpHttpField(props: { label: string; value: string; copied: boolean; onCopy(): void }) {
  const id = `mcp-http-${props.label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="mt-2.5 flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{props.label}</label>
      <div className="flex min-w-0 items-center gap-1.5">
        <Input id={id} className="flex-1 font-mono text-sm" type="text" readOnly spellCheck={false} value={props.value} />
        <CopyButton copied={props.copied} onCopy={props.onCopy} label={props.label} />
      </div>
    </div>
  );
}

/** Icon-only copy button (clipboard ↔ accent check — palette is
 * cyan/amber/red, no green). Sized to match the h-7 Input/Button rows. */
function CopyButton(props: { copied: boolean; disabled?: boolean; onCopy(): void; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={
        'flex-none '
        + (props.copied
          ? 'border-accent/40 bg-accent/10 text-accent hover:border-accent/40 hover:bg-accent/10 hover:text-accent'
          : 'text-muted-foreground hover:border-accent hover:text-accent')
      }
      disabled={props.disabled}
      onClick={props.onCopy}
      title={props.copied ? 'Copied' : `Copy ${props.label}`}
      aria-label={props.copied ? 'Copied' : `Copy ${props.label}`}
    >
      {props.copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </Button>
  );
}

function normalizeClientStatuses(
  clients: Record<string, boolean | { configured?: boolean; cliInstalled?: boolean; restartRequired?: boolean }>,
): Record<string, McpClientStatus> {
  return Object.fromEntries(Object.entries(clients).map(([id, value]) => {
    if (typeof value === 'boolean') return [id, { configured: value, restartRequired: value }];
    return [id, {
      configured: value.configured === true,
      ...(typeof value.cliInstalled === 'boolean' ? { cliInstalled: value.cliInstalled } : {}),
      restartRequired: value.restartRequired === true,
    }];
  }));
}

function clientBadge(
  client: { cliId?: string },
  status: McpClientStatus,
): { label: string; tone: string; title: string } | null {
  if (client.cliId && status.cliInstalled === false) {
    return {
      label: 'CLI missing',
      tone: 'warn',
      title: 'Install the CLI before starting the built-in chat.',
    };
  }
  if (status.restartRequired) {
    return {
      label: 'Restart client',
      tone: 'pending',
      title: 'The config is written. Restart the client so it picks up StashBase.',
    };
  }
  return null;
}
