/** Build the shared-agent connection URL without leaking a prior tab model
 * into a resumed native session. Kept pure so resume semantics stay covered
 * without a browser/WebSocket harness. */
export function agentConnectionUrl({
  protocol,
  host,
  endpoint,
  windowId,
  effort,
  access,
  agent,
  model,
  resume,
}: {
  protocol: string;
  host: string;
  endpoint: string;
  windowId: string;
  effort: string;
  access: string;
  agent: string;
  model?: string;
  resume?: string | null;
}): string {
  const query = new URLSearchParams({ windowId, effort, access, agent });
  if (!resume && model) query.set('model', model);
  if (resume) query.set('resume', resume);
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${endpoint}?${query}`;
}
