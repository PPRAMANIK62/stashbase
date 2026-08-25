/**
 * Settings → MCP panel. A read-only access surface for any MCP-compatible
 * client: the standard stdio config to copy, URL access (token-gated
 * Streamable HTTP), and the Docker opt-in. StashBase never writes an
 * external client's configuration here — the built-in Chat agents are
 * wired automatically by Agent readiness (Settings → Agents).
 */
import { useId, useState } from 'react';
import { useMcpAccess } from '@/features/settings/hooks/useMcpAccess';
import { CopyIcon, CheckIcon } from '@/common/components/icons';
import { MCP_SETUP_EXAMPLES_URL, openExternalUrl } from '@/common/lib/externalLink';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Field, FieldLabel } from '@/common/components/ui/field';
import { StatusMessage } from '@/common/components/ui/status';
import { SectionDescription, SectionHeading } from '@/common/components/ui/section';
import { cn } from '@/common/lib/utils';

export function McpAccessPanel() {
  const {
    config,
    http,
    status,
    loadError,
    httpBusy,
    copied,
    dockerPortInput,
    setDockerPortInput,
    reload,
    copyText,
    rotateToken,
    setDockerAccess,
    saveDockerPort,
  } = useMcpAccess();
  const [showToken, setShowToken] = useState(false);

  return (
    <div>
      <SectionHeading level={3} className="mb-1">MCP access</SectionHeading>
      <SectionDescription className="mb-2.5">
        The built-in Chat agents connect automatically during Agent setup. Use
        this page for manual recovery or to give external MCP clients access to
        your StashBase library.
      </SectionDescription>

      <SectionHeading level={4} className="mt-4 mb-1">Local command</SectionHeading>
      <SectionDescription className="mb-2.5">
        Paste this configuration into an external client’s MCP settings, then
        restart that client.{' '}
        {/* Inline in the sentence, so the default size is taken for the
          * type step alone and the height/padding come straight back off.
          * Accent rather than the link variant's primary, and the
          * underline inverts on hover, which is this description's
          * established treatment. */}
        <Button
          variant="link"
          className="h-auto cursor-pointer border-0 p-0 text-accent underline underline-offset-2 hover:no-underline"
          onClick={() => openExternalUrl(MCP_SETUP_EXAMPLES_URL)}
        >
          See setup examples
        </Button>
        {' '}for Claude Desktop, Codex CLI, Claude Code, and other clients.
      </SectionDescription>
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          {/* The caption names the block below it, so it is a heading and
            * not a bold run of text — the type stays exactly what it was
            * (the eyebrow step, not the recipe's `text-base`), because the
            * level is what changed here, never the look. */}
          <SectionHeading level={5} className="text-xs tracking-wider text-muted-foreground uppercase">
            MCP JSON configuration
          </SectionHeading>
          <CopyButton
            copied={copied === 'stdio'}
            onCopy={() => void copyText(config, 'stdio')}
            label="configuration"
          />
        </div>
        <pre className="m-0 max-h-80 overflow-auto p-3 font-mono text-xs whitespace-pre text-foreground">{config}</pre>
      </div>
      {status && (
        <StatusMessage tone={status.kind === 'error' ? 'error' : 'success'} className="mt-2.5 wrap-anywhere">
          {status.text}
        </StatusMessage>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <SectionHeading level={4} className="mb-1">Server connection</SectionHeading>
        <SectionDescription className="mb-2.5">
          For server-side MCP clients that cannot launch the local command. Browser pages are not supported.
        </SectionDescription>
        {http ? (
          <>
            {http.settingsError && (
              <div className="text-sm text-destructive">
                Server connection settings are unavailable: {http.settingsError}
              </div>
            )}
            <McpHttpField
              label="Local URL"
              value={http.loopbackUrl}
              copied={copied === 'loopback'}
              onCopy={() => void copyText(http.loopbackUrl, 'loopback')}
            />
            <Field className="mt-2.5 gap-1">
              <FieldLabel htmlFor="mcp-http-token" className="text-xs text-muted-foreground">Bearer token</FieldLabel>
              <div className="flex min-w-0 items-center gap-1.5">
                <Input
                  id="mcp-http-token"
                  className="h-8 flex-1 font-mono text-sm"
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  spellCheck={false}
                  value={http.token ?? ''}
                  placeholder={http.settingsError ? 'Unavailable' : undefined}
                />
                <Button variant="outline" disabled={!http.token} onClick={() => setShowToken((shown) => !shown)}>
                  {showToken ? 'Hide' : 'Show'}
                </Button>
                <CopyButton
                  copied={copied === 'token'}
                  disabled={!http.token}
                  onCopy={() => http.token && void copyText(http.token, 'token')}
                  label="token"
                />
              </div>
            </Field>
            <div className="mt-3">
              <Button variant="outline" disabled={httpBusy || !http.token} onClick={() => void rotateToken()}>
                Rotate token…
              </Button>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <SectionHeading level={5} className="mb-1">Advanced</SectionHeading>
              {/* The Base UI checkbox, not the UA control: a native
                * `input[type=checkbox]` beside the primitive gave the app
                * two checkbox appearances. `htmlFor` targets the
                * primitive's root, which is a labelable `button`, so the
                * visible text still toggles it. */}
              <div className="inline-flex items-center gap-1.5">
                <Checkbox
                  id="mcp-http-docker-access"
                  checked={http.dockerAccess}
                  disabled={httpBusy || !!http.settingsError}
                  onCheckedChange={(checked) => { void setDockerAccess(checked); }}
                />
                <FieldLabel htmlFor="mcp-http-docker-access" className="cursor-pointer text-sm font-normal">
                  Enable Docker access
                </FieldLabel>
              </div>
              <Field className="mt-2.5 gap-1">
                <FieldLabel htmlFor="mcp-http-docker-port" className="text-xs text-muted-foreground">Docker port</FieldLabel>
                {/* A field with one confirm action beside it, so it is a
                  * `form`: Enter in the port box now saves it, which is
                  * behaviour the row simply did not have. `type="submit"`
                  * is explicit — Base UI's `useButton` writes
                  * `type="button"` on every Button. */}
                <form
                  className="flex min-w-0 items-center gap-1.5"
                  onSubmit={(event) => { event.preventDefault(); void saveDockerPort(); }}
                >
                  <Input
                    id="mcp-http-docker-port"
                    className="h-8 flex-1 font-mono text-sm"
                    type="number"
                    min={1024}
                    max={65535}
                    step={1}
                    value={dockerPortInput}
                    disabled={httpBusy || http.dockerAccess || !!http.settingsError}
                    onChange={(event) => setDockerPortInput(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={httpBusy || http.dockerAccess || !!http.settingsError || dockerPortInput === String(http.dockerPort)}
                  >
                    Save port
                  </Button>
                </form>
              </Field>
              <SectionDescription className="mt-3.5">
                Disabled by default. Enabling opens a separate token-gated MCP-only port on host interfaces; no other StashBase API is exposed. Disable access before changing the port. Docker Desktop or the host firewall must allow that port.
              </SectionDescription>
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
                  <SectionDescription className="mt-3.5 [&_code]:font-mono [&_code]:text-xs [&_code]:whitespace-nowrap [&_code]:text-accent">
                    Native Linux Docker Engine also needs <code>--add-host=host.docker.internal:host-gateway</code> or the equivalent Compose <code>extra_hosts</code> entry.
                  </SectionDescription>
                </>
              )}
            </div>
          </>
        ) : loadError ? (
          <div className="py-3">
            <StatusMessage tone="error" className="wrap-anywhere">
              Couldn’t load MCP access settings: {loadError}
            </StatusMessage>
            <Button variant="outline" className="mt-2.5" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="py-3 text-base text-muted-foreground">Loading server connection…</div>
        )}
      </div>
    </div>
  );
}

function McpHttpField(props: { label: string; value: string; copied: boolean; onCopy(): void }) {
  const id = useId();
  return (
    <Field className="mt-2.5 gap-1">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">{props.label}</FieldLabel>
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          id={id}
          className="h-8 flex-1 font-mono text-sm"
          type="text"
          readOnly
          spellCheck={false}
          value={props.value}
        />
        <CopyButton copied={props.copied} onCopy={props.onCopy} label={props.label} />
      </div>
    </Field>
  );
}

/** Icon-only copy button (clipboard ↔ accent check — palette is
 * cyan/amber/red, no green). Sized to match the h-8 Input/Button rows. */
function CopyButton(props: { copied: boolean; disabled?: boolean; onCopy(): void; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'flex-none',
        props.copied
          ? 'border-accent/40 bg-accent/10 text-accent hover:border-accent/40 hover:bg-accent/10 hover:text-accent'
          : 'text-muted-foreground hover:border-accent hover:text-accent',
      )}
      disabled={props.disabled}
      onClick={props.onCopy}
      title={props.copied ? 'Copied' : `Copy ${props.label}`}
      aria-label={props.copied ? 'Copied' : `Copy ${props.label}`}
    >
      {/* No icon size here: `size="icon"` is the 32px step, and the recipe
        * gives its glyph the matching 16px. */}
      {props.copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
