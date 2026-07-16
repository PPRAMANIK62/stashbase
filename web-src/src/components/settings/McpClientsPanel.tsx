/**
 * Settings → MCP panel. Three clients auto-connect (StashBase writes their
 * config file); every other client just gets the standard MCP config shown
 * inline below, with their names listed for reference.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type McpHttpStatus } from '../../api';
import { MCP_CLIENTS, mcpClientLabel, type McpClientId } from '../../agentCatalog';
import { CopyIcon, CheckIcon } from '../../icons';

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
    <div className="settings-section">
      <div className="settings-section-title">MCP clients</div>
      <div className="settings-section-hint">
        Connect StashBase to your agents. Restart each app after connecting.
      </div>
      <div className="mcp-client-list">
        {MCP_CLIENTS.map((client) => {
          const status = clientStatus[client.id] ?? { configured: false };
          const badge = clientBadge(client, status);
          const isConnected = status.configured;
          const isBusy = busy === client.id;
          const Icon = client.Icon;
          return (
            <div className="mcp-client-row" key={client.id}>
              <span className="mcp-client-label">
                <span className="mcp-client-icon">
                  <Icon />
                </span>
                <span className="mcp-client-copy">
                  <span className="mcp-client-name">{client.name}</span>
                </span>
              </span>
              {badge && (
                <span className={'mcp-status-pill ' + badge.tone} title={badge.title}>
                  {badge.label}
                </span>
              )}
              <button
                type="button"
                className={'modal-btn mcp-connector-btn' + (isConnected ? ' connected' : '')}
                disabled={busy != null}
                onClick={() => void (isConnected ? disconnect(client.id) : connect(client.id))}
                title={isConnected ? `Disconnect ${client.name}` : `Connect ${client.name}`}
              >
                {isBusy
                  ? (isConnected ? 'Disconnecting…' : 'Connecting…')
                  : isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>
      {status && (
        <div className={status.kind === 'error' ? 'modal-error' : 'mcp-success'}>
          {status.text}
        </div>
      )}

      <div className="mcp-http-settings">
        <div className="settings-section-title">URL access</div>
        <div className="settings-section-hint">
          For server-side MCP clients that cannot launch the local command. Browser pages are not supported.
        </div>
        {http ? (
          <>
            {http.settingsError && (
              <div className="settings-error">
                URL access settings are unavailable: {http.settingsError}
              </div>
            )}
            <McpHttpField
              label="Local URL"
              value={http.loopbackUrl}
              copied={copied === 'loopback'}
              onCopy={() => void copyText(http.loopbackUrl, 'loopback')}
            />
            <div className="mcp-http-field">
              <label htmlFor="mcp-http-token">Bearer token</label>
              <div className="mcp-http-field-controls">
                <input
                  id="mcp-http-token"
                  className="settings-text-input"
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  spellCheck={false}
                  value={http.token ?? ''}
                  placeholder={http.settingsError ? 'Unavailable' : undefined}
                />
                <button type="button" className="settings-secondary-btn" disabled={!http.token} onClick={() => setShowToken((shown) => !shown)}>
                  {showToken ? 'Hide' : 'Show'}
                </button>
                <CopyButton
                  copied={copied === 'token'}
                  disabled={!http.token}
                  onCopy={() => http.token && void copyText(http.token, 'token')}
                  label="token"
                />
              </div>
            </div>
            <div className="mcp-http-actions">
              <button type="button" className="settings-secondary-btn" disabled={httpBusy || !http.token} onClick={() => void rotateToken()}>
                Rotate token…
              </button>
              <label className="mcp-http-docker-toggle">
                <input
                  type="checkbox"
                  checked={http.dockerAccess}
                  disabled={httpBusy || !!http.settingsError}
                  onChange={(event) => void setDockerAccess(event.target.checked)}
                />
                <span>Enable Docker access</span>
              </label>
            </div>
            <div className="mcp-http-field">
              <label htmlFor="mcp-http-docker-port">Docker port</label>
              <div className="mcp-http-field-controls">
                <input
                  id="mcp-http-docker-port"
                  className="settings-text-input"
                  type="number"
                  min={1024}
                  max={65535}
                  step={1}
                  value={dockerPortInput}
                  disabled={httpBusy || http.dockerAccess || !!http.settingsError}
                  onChange={(event) => setDockerPortInput(event.target.value)}
                />
                <button
                  type="button"
                  className="settings-secondary-btn"
                  disabled={httpBusy || http.dockerAccess || !!http.settingsError || dockerPortInput === String(http.dockerPort)}
                  onClick={() => void saveDockerPort()}
                >
                  Save port
                </button>
              </div>
            </div>
            <div className="settings-section-hint settings-hint-foot">
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
                <div className={http.dockerActive ? 'settings-ok' : 'settings-error'}>
                  {http.dockerActive
                    ? 'Docker listener is active.'
                    : `Docker listener is not active${http.dockerError ? `: ${http.dockerError}` : '.'}`}
                </div>
                <div className="settings-section-hint settings-hint-foot">
                  Native Linux Docker Engine also needs <code>--add-host=host.docker.internal:host-gateway</code> or the equivalent Compose <code>extra_hosts</code> entry.
                </div>
              </>
            )}
          </>
        ) : (
          <div className="settings-note">Loading URL access…</div>
        )}
      </div>

      <div className="mcp-other">
        <div className="settings-section-hint">
          For any other MCP-compatible agent, paste this configuration into its MCP settings:
        </div>
        <div className="mcp-config-preview">
          <div className="mcp-config-preview-head">
            MCP configuration
            <button
              type="button"
              className={'mcp-config-copy' + (copied === 'stdio' ? ' copied' : '')}
              onClick={() => void copyText(config, 'stdio')}
              title={copied === 'stdio' ? 'Copied' : 'Copy configuration'}
              aria-label={copied === 'stdio' ? 'Copied' : 'Copy configuration'}
            >
              {copied === 'stdio' ? <CheckIcon className="mcp-config-copy-icon" /> : <CopyIcon className="mcp-config-copy-icon" />}
            </button>
          </div>
          <pre>{config}</pre>
        </div>
      </div>
    </div>
  );
}

function McpHttpField(props: { label: string; value: string; copied: boolean; onCopy(): void }) {
  const id = `mcp-http-${props.label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="mcp-http-field">
      <label htmlFor={id}>{props.label}</label>
      <div className="mcp-http-field-controls">
        <input id={id} className="settings-text-input" type="text" readOnly spellCheck={false} value={props.value} />
        <CopyButton copied={props.copied} onCopy={props.onCopy} label={props.label} />
      </div>
    </div>
  );
}

function CopyButton(props: { copied: boolean; disabled?: boolean; onCopy(): void; label: string }) {
  return (
    <button
      type="button"
      className={'mcp-config-copy mcp-http-copy' + (props.copied ? ' copied' : '')}
      disabled={props.disabled}
      onClick={props.onCopy}
      title={props.copied ? 'Copied' : `Copy ${props.label}`}
      aria-label={props.copied ? 'Copied' : `Copy ${props.label}`}
    >
      {props.copied ? <CheckIcon className="mcp-config-copy-icon" /> : <CopyIcon className="mcp-config-copy-icon" />}
    </button>
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
