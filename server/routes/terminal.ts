/**
 * Agent CLI registry routes: enumerate the supported CLIs (with their
 * installed-state). The chat panel reads these to populate its launchers;
 * the CLIs themselves run via structured agent bridges, not a PTY.
 */
import express from 'express';
import { discoverAgentRuntimes } from '../agent-contract.ts';

export function mount(app: express.Express): void {
  // Agent CLI registry. The renderer reads this to populate the launchers
  // and know each CLI's installed-state.
  app.get('/api/terminal/clis', (_req, res) => {
    res.json({ clis: discoverAgentRuntimes() });
  });
}
