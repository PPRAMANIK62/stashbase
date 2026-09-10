/**
 * What Settings knows about MCP access: the standard configuration an external
 * client is given, and the Streamable HTTP listener that client can reach
 * instead.
 *
 * The transport reports the Docker listener as two booleans and an optional
 * reason, and those can disagree — the opt-in is durable while the listener is
 * runtime state, so "asked for, not up yet" and "up although the opt-in never
 * saved" are both real. `mcpDockerState` resolves that into the one word the
 * page shows, and it answers from the listener rather than from the opt-in, so
 * a host-facing port that is genuinely open is never drawn as off.
 */

export interface McpHttpAccess {
  /** The user's durable opt-in to the host-facing listener. */
  readonly dockerAccess: boolean;
  /** Whether that listener is actually up right now. */
  readonly dockerActive: boolean;
  readonly dockerError: string | null;
  readonly dockerPort: number;
  readonly dockerUrl: string;
  readonly loopbackUrl: string;
  /** Absent rather than empty when the credential store cannot be read. */
  readonly token: string | null;
  /** The credential store itself is unreadable; every write below will fail. */
  readonly settingsError: string | null;
}

export interface McpAccess {
  /** The launcher path the standard configuration invokes. */
  readonly command: string;
  /** The stdio configuration block, formatted for pasting. */
  readonly config: string;
  readonly http: McpHttpAccess;
}

export type McpDockerState = 'off' | 'starting' | 'active' | 'failed';

/** The one word the Docker group reports, read off the listener first. */
export function mcpDockerState(http: McpHttpAccess): McpDockerState {
  if (http.dockerActive) return 'active';
  if (!http.dockerAccess) return 'off';
  return http.dockerError === null ? 'starting' : 'failed';
}

/** The listener was asked for and has neither come up nor failed, so the page
 *  has something to wait for. */
export function mcpDockerSettling(http: McpHttpAccess): boolean {
  return mcpDockerState(http) === 'starting';
}

/** The stdio block as a client's configuration file wants it. */
export function formatMcpConfig(config: Record<string, unknown>): string {
  return JSON.stringify(config, null, 2);
}

/** The unprivileged range the server accepts for the Docker listener. */
export const MCP_DOCKER_PORT_RANGE = { max: 65_535, min: 1024 } as const;

export function isMcpDockerPort(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MCP_DOCKER_PORT_RANGE.min &&
    value <= MCP_DOCKER_PORT_RANGE.max
  );
}
