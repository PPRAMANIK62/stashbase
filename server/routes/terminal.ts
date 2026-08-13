/**
 * Agent CLI registry routes: enumerate the supported CLIs (with their
 * installed-state). The chat panel reads these to populate its launchers;
 * the CLIs themselves run via structured agent bridges, not a PTY.
 */
import express from 'express';
import { discoverAgentRuntimes, stopAgentRuntime } from '../agent-contract.ts';
import { sendError } from '../http.ts';
import {
  agentRuntimeDebugEnabled,
  getAgentRuntimeDebugState,
  removeManagedAgentRuntime,
  setAgentRuntimeDebugState,
  type ManagedAgentId,
} from '../agent-runtime-paths.ts';
import { beginAgentBootstrap, resetAgentBootstrap } from '../agent-runtime-installer.ts';

function agentId(value: unknown): ManagedAgentId | null {
  return value === 'claude' || value === 'codex' ? value : null;
}

function agentCatalogResponse() {
  return { clis: discoverAgentRuntimes(), debug: getAgentRuntimeDebugState() };
}

export function mount(app: express.Express): void {
  // Agent CLI registry. The renderer reads this to populate the launchers
  // and know each CLI's installed-state.
  app.get('/api/terminal/clis', (_req, res) => {
    res.json(agentCatalogResponse());
  });

  /** New Chat readiness gate. Existing runtimes only receive the idempotent
   * MCP connection; missing runtimes begin an application-scoped download. */
  app.post('/api/terminal/clis/:id/bootstrap', (req, res) => {
    const id = agentId(req.params.id);
    if (!id) {
      res.status(404).json({ error: 'Unsupported Agent runtime.' });
      return;
    }
    try {
      beginAgentBootstrap(id);
      res.status(202).json(agentCatalogResponse());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.put('/api/terminal/debug', (req, res) => {
    try {
      setAgentRuntimeDebugState(req.body ?? {});
      res.json(agentCatalogResponse());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete('/api/terminal/clis/:id/managed', async (req, res) => {
    const id = agentId(req.params.id);
    if (!id) {
      res.status(404).json({ error: 'Unsupported Agent runtime.' });
      return;
    }
    if (!agentRuntimeDebugEnabled()) {
      res.status(404).json({ error: 'Agent runtime test controls are available in development builds only.' });
      return;
    }
    try {
      stopAgentRuntime(id);
      await resetAgentBootstrap(id);
      removeManagedAgentRuntime(id);
      res.json(agentCatalogResponse());
    } catch (error) {
      sendError(res, error);
    }
  });
}
