/**
 * Settings → MCP: what an external client needs to reach this library, and the
 * two ways it can reach it. StashBase never writes another client's
 * configuration, so every row here is something to read or copy, beside the
 * three writes that change how the listener is reached.
 *
 * The Docker listener is drawn off the one `McpDockerState` the domain
 * resolves rather than off the opt-in and the live listener separately, so
 * "asked for, not up yet" and "up although the opt-in never saved" each get
 * their own word instead of colliding on one boolean.
 */

import { Check, CircleAlert, Copy } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InputField, InputGroup } from '@/components/ui/input-group';
import { Switch } from '@/components/ui/switch';
import type { McpAccessPort } from '@/features/settings/application/ports';
import {
  isMcpDockerPort,
  MCP_DOCKER_PORT_RANGE,
  type McpDockerState,
} from '@/features/settings/domain/mcp-access';
import { useMcpAccess } from '@/features/settings/hooks/use-mcp-access';
import { FailureNotice } from '@/features/settings/ui/failure-notice';
import {
  Disclosure,
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
  StatusChip,
} from '@/features/settings/ui/rows';

export interface McpAccessPanelProps {
  mcpAccessApi: McpAccessPort;
}

const PORT_ERROR = `Enter a port from ${MCP_DOCKER_PORT_RANGE.min} to ${MCP_DOCKER_PORT_RANGE.max}.`;

/** Fixed width rather than one dot per character: the row must not change
 *  shape when a rotation lands, and a mask that counts out the credential is
 *  telling the room something about it. */
const TOKEN_MASK = '••••••••••••••••';

/** A value the reader copies verbatim, so it is set in the monospace face and
 *  allowed to break anywhere rather than pushing the row wide. */
function Mono({ children }: { children: string }) {
  return <span className="font-mono break-all">{children}</span>;
}

function CopyButton({
  copied,
  disabled = false,
  label,
  onCopy,
}: {
  copied: boolean;
  disabled?: boolean;
  label: string;
  onCopy: () => void;
}) {
  return (
    <>
      <Button
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        disabled={disabled}
        onClick={onCopy}
        size="icon-compact"
        variant="ghost"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      {/* The icon and name flip alone is silent: a name change on a control
          that already holds focus is not re-announced. This region is empty at
          rest and speaks the moment the copy lands. */}
      <span className="sr-only" role="status">
        {copied ? 'Copied' : ''}
      </span>
    </>
  );
}

/** Keyed by the saved port, so a server-side change replaces the draft
 *  instead of an effect having to reconcile it. */
function DockerPortForm({
  disabled,
  onSave,
  port,
}: {
  disabled: boolean;
  onSave: (port: number) => void;
  port: number;
}) {
  const [draft, setDraft] = useState(String(port));
  const parsed = Number(draft);
  const invalid = draft !== '' && !isMcpDockerPort(parsed);
  const refused = disabled || invalid || draft === '' || parsed === port;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (refused) return;
    onSave(parsed);
  };
  return (
    <form className="flex items-start gap-1.5" onSubmit={submit}>
      <InputGroup className="w-40" size="compact">
        <InputField
          disabled={disabled}
          error={invalid ? PORT_ERROR : undefined}
          filled
          inputMode="numeric"
          label="Docker port"
          labelHidden
          max={MCP_DOCKER_PORT_RANGE.max}
          min={MCP_DOCKER_PORT_RANGE.min}
          onChange={setDraft}
          type="number"
          value={draft}
        />
      </InputGroup>
      <Button disabled={refused} size="compact" type="submit" variant="tertiary">
        Save port
      </Button>
    </form>
  );
}

/** The listener row, resolved from the one state word rather than from a
 *  chain of checks against the opt-in and the live listener. */
function dockerListener(
  state: McpDockerState,
  error: string | null,
): { chip: ReactNode; detail: ReactNode; detailTone: 'error' | 'muted' } | null {
  switch (state) {
    case 'active':
      return { chip: <StatusChip>Listening</StatusChip>, detail: null, detailTone: 'muted' };
    case 'starting':
      return {
        chip: <StatusChip tone="muted">Starting…</StatusChip>,
        detail: null,
        detailTone: 'muted',
      };
    case 'failed':
      return {
        chip: <StatusChip tone="warn">Not listening</StatusChip>,
        detail: error,
        detailTone: 'error',
      };
    case 'off':
      return null;
  }
}

export function McpAccessPanel({ mcpAccessApi }: McpAccessPanelProps) {
  const mcp = useMcpAccess(mcpAccessApi);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const access = mcp.access;

  if (mcp.loading) {
    return (
      <p className="text-caption text-muted-foreground" role="status">
        Loading MCP access…
      </p>
    );
  }
  if (!access) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-destructive" role="alert">
          MCP access is unavailable.
        </p>
        <Button onClick={() => mcp.reload()} size="compact" variant="tertiary">
          Retry
        </Button>
      </div>
    );
  }

  const http = access.http;
  const unreadable = http.settingsError !== null;
  const listener = dockerListener(mcp.dockerState, http.dockerError);

  return (
    <SettingsPane
      lede="External MCP clients read your authorized library through the same operations the built-in Agent uses. StashBase never writes another client's configuration; copy what that client needs from this page."
      title="MCP"
    >
      <SettingsGroup
        hint="Paste this into an external client's MCP settings, then restart that client."
        title="Standard configuration"
      >
        <SettingsList>
          <SettingsRow
            detail={<Mono>{access.command}</Mono>}
            title="MCP JSON configuration"
            trail={
              <CopyButton
                copied={mcp.copied === 'config'}
                label="configuration"
                onCopy={() => mcp.copy('config')}
              />
            }
          >
            <pre className="m-0 max-h-80 overflow-auto font-mono text-caption whitespace-pre text-muted-foreground">
              {access.config}
            </pre>
          </SettingsRow>
        </SettingsList>
      </SettingsGroup>

      <SettingsGroup
        hint="For MCP clients that cannot launch the local command. Every request carries the bearer token; rotating it invalidates the old one without a restart."
        title="URL access"
      >
        <SettingsList>
          {http.settingsError !== null && (
            <SettingsRow
              detail={http.settingsError}
              lead={<CircleAlert aria-hidden="true" className="size-4 text-destructive" />}
              role="alert"
              title="MCP settings are unavailable"
              titleTone="error"
            />
          )}
          <SettingsRow
            detail={<Mono>{http.loopbackUrl}</Mono>}
            title="Local URL"
            trail={
              <CopyButton
                copied={mcp.copied === 'loopback'}
                label="local URL"
                onCopy={() => mcp.copy('loopback')}
              />
            }
          />
          <SettingsRow
            detail={
              http.token === null ? (
                'Unavailable while the credential store cannot be read.'
              ) : (
                <Mono>{revealed ? http.token : TOKEN_MASK}</Mono>
              )
            }
            title="Bearer token"
            trail={
              <>
                <Button
                  aria-label={revealed ? 'Hide token' : 'Show token'}
                  disabled={http.token === null}
                  onClick={() => setRevealed(!revealed)}
                  size="compact"
                  variant="ghost"
                >
                  {revealed ? 'Hide' : 'Show'}
                </Button>
                <CopyButton
                  copied={mcp.copied === 'token'}
                  disabled={http.token === null}
                  label="token"
                  onCopy={() => mcp.copy('token')}
                />
                <Button
                  disabled={http.token === null}
                  onClick={() => setConfirming(true)}
                  size="compact"
                  variant="tertiary"
                >
                  Rotate token…
                </Button>
              </>
            }
          />
        </SettingsList>
      </SettingsGroup>

      <SettingsGroup
        hint="Off by default. Turning it on opens a separate token-gated listener on host interfaces that serves only MCP; no other StashBase API is exposed."
        title="Docker access"
      >
        <SettingsList>
          <SettingsRow
            detail="A container on this machine reaches MCP over the host-facing listener only while this is on."
            title="Docker access"
            trail={
              <Switch
                checked={http.dockerAccess}
                disabled={mcp.busy || unreadable}
                label="Docker access"
                labelHidden
                onToggle={() => mcp.setDockerAccess(!http.dockerAccess)}
              />
            }
          />
          <SettingsRow
            detail={
              http.dockerAccess
                ? 'Turn Docker access off to change the port.'
                : 'The host-facing listener binds this port when Docker access is on.'
            }
            title="Port"
            trail={
              <DockerPortForm
                disabled={mcp.busy || http.dockerAccess || unreadable}
                key={http.dockerPort}
                onSave={(port) => mcp.setDockerPort(port)}
                port={http.dockerPort}
              />
            }
          />
          {listener && (
            <>
              <SettingsRow
                detail={<Mono>{http.dockerUrl}</Mono>}
                title="Docker URL"
                trail={
                  <CopyButton
                    copied={mcp.copied === 'docker'}
                    label="Docker URL"
                    onCopy={() => mcp.copy('docker')}
                  />
                }
              />
              <SettingsRow
                detail={listener.detail}
                detailTone={listener.detailTone}
                role="status"
                title="Listener"
                trail={listener.chip}
              />
            </>
          )}
        </SettingsList>
        <Disclosure summary="Native Linux Docker Engine">
          <p className="text-caption text-muted-foreground">
            A container there resolves <Mono>host.docker.internal</Mono> only with{' '}
            <Mono>--add-host=host.docker.internal:host-gateway</Mono>, or the equivalent Compose{' '}
            <Mono>extra_hosts</Mono> entry.
          </p>
        </Disclosure>
      </SettingsGroup>

      <ConfirmDialog
        confirmLabel="Rotate"
        description="Clients using the current token stop working until you give them the new one."
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => mcp.rotateToken(() => setConfirming(false))}
        open={confirming}
        pending={mcp.rotating}
        title="Rotate the MCP bearer token?"
      />

      {mcp.failure && <FailureNotice failure={mcp.failure} />}
    </SettingsPane>
  );
}
