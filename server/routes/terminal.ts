/**
 * Agent CLI registry routes: enumerate the supported CLIs (with their
 * installed-state). The chat panel reads these to populate its launchers;
 * the CLIs themselves run via structured agent bridges, not a PTY.
 */
import express from 'express';
import { discoverAgentRuntimes } from '../agent-contract.ts';
import { ensureAgentModelCatalog } from '../agent-model-catalog.ts';
import { sendError } from '../http.ts';
import {
  getAgentRuntimeDebugState,
  setAgentRuntimeDebugState,
  type NativeAgentId,
} from '../agent-runtime-paths.ts';
import {
  agentSupportsInAppUpdate,
  beginAgentBootstrap,
  loginAgentBootstrap,
  recheckAgentBootstrap,
  updateAgentBootstrap,
} from '../agent-runtime-installer.ts';
import type { AgentId } from '../../shared/agent-protocol.ts';

function agentId(value: unknown): AgentId | null {
  return value === 'stashbase' || value === 'claude' || value === 'codex' ? value : null;
}

function nativeAgentId(value: unknown): NativeAgentId | null {
  return value === 'claude' || value === 'codex' ? value : null;
}

function agentCatalogResponse() {
  return { clis: discoverAgentRuntimes(), debug: getAgentRuntimeDebugState() };
}

/** A runtime that can run a turn gets its catalog memory completed before
 * the listing answers: one runtime-level read when nothing is remembered, or
 * when what is remembered names no default, so the first Chat on a fresh
 * install can name its model. The memory decides whether a read is due, and
 * a read that fails is not retried until its pause has passed, so a runtime
 * that cannot answer never slows the listing twice in a row. */
async function primeAgentModelCatalogs(): Promise<void> {
  await Promise.all(
    discoverAgentRuntimes()
      .filter((runtime) => runtime.capabilities.models && runtime.installed && runtime.state === 'available')
      .map((runtime) => ensureAgentModelCatalog(runtime.id)),
  );
}

export function mount(app: express.Express): void {
  // Agent CLI registry. The renderer reads this to populate the launchers
  // and know each CLI's installed-state.
  app.get('/api/terminal/clis', async (_req, res) => {
    await primeAgentModelCatalogs();
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
      if (id === 'stashbase') {
        res.json(agentCatalogResponse());
        return;
      }
      beginAgentBootstrap(id);
      res.status(202).json(agentCatalogResponse());
    } catch (error) {
      sendError(res, error);
    }
  });

  /** Explicit recheck after the user installs or repairs a CLI outside the
   * app. This may perform idempotent MCP preparation for a discovered runtime
   * but never starts a managed download when the CLI is still missing. */
  app.post('/api/terminal/clis/:id/check', (req, res) => {
    const id = agentId(req.params.id);
    if (!id) {
      res.status(404).json({ error: 'Unsupported Agent runtime.' });
      return;
    }
    try {
      if (id === 'stashbase') {
        res.json(agentCatalogResponse());
        return;
      }
      recheckAgentBootstrap(id);
      res.json(agentCatalogResponse());
    } catch (error) {
      sendError(res, error);
    }
  });

  /** Launch the selected Codex executable's provider-owned browser login.
   * This never installs another CLI or handles provider credentials itself. */
  app.post('/api/terminal/clis/:id/login', (req, res) => {
    const id = nativeAgentId(req.params.id);
    if (!id) {
      res.status(404).json({ error: 'Unsupported Agent runtime.' });
      return;
    }
    if (id !== 'codex') {
      res.status(400).json({ error: 'In-app login is available only for Codex.' });
      return;
    }
    try {
      loginAgentBootstrap(id);
      res.status(202).json(agentCatalogResponse());
    } catch (error) {
      sendError(res, error);
    }
  });

  /** Run the installed runtime's own updater in place. Offered where a chat
   * reports the runtime too old for its model and on the Settings row; the
   * runtime keeps ownership of its installation throughout. */
  app.post('/api/terminal/clis/:id/update', (req, res) => {
    const id = nativeAgentId(req.params.id);
    if (!id) {
      res.status(404).json({ error: 'Unsupported Agent runtime.' });
      return;
    }
    if (!agentSupportsInAppUpdate(id)) {
      res.status(400).json({ error: 'In-app update is not available for this Agent.' });
      return;
    }
    try {
      updateAgentBootstrap(id);
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
}
