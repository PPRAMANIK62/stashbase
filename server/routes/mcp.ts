/**
 * Settings → MCP routes. Read-only access surface for any MCP-compatible
 * client: the standard stdio config to copy plus the Streamable HTTP
 * settings (token, Docker opt-in). No route here writes a third-party
 * client's configuration — the built-in Chat runtimes are wired by Agent
 * readiness through `ensureAgentMcp` in `server/agent-mcp.ts`.
 */
import express from 'express';
import { sendError } from '../http.ts';
import { ensureMcpLauncher, standardMcpJson } from '../agent-mcp.ts';
import type { McpHttpService } from '../mcp-http-service.ts';

export function mount(app: express.Express, httpService: McpHttpService): void {
  app.get('/api/mcp/status', (_req, res) => {
    try {
      // Regenerate the launcher so the inline config we hand back actually
      // works when pasted.
      const wrapper = ensureMcpLauncher();
      res.json({
        command: wrapper,
        config: standardMcpJson(wrapper),
        http: httpService.status(),
      });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.post('/api/mcp/http/token', (_req, res) => {
    try {
      res.json({ ok: true, http: httpService.rotateToken() });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.put('/api/mcp/http/docker-access', (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') {
      res.status(400).json({ error: '`enabled` must be a boolean', code: 'BAD_REQUEST' });
      return;
    }
    void httpService.setDockerAccess(req.body.enabled)
      .then((http) => res.json({ ok: true, http }))
      .catch((err: unknown) => sendError(res, err));
  });

  app.put('/api/mcp/http/docker-port', (req, res) => {
    const port = req.body?.port;
    if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
      res.status(400).json({
        error: '`port` must be an integer from 1024 to 65535',
        code: 'BAD_REQUEST',
      });
      return;
    }
    void httpService.setDockerPort(port)
      .then((http) => res.json({ ok: true, http }))
      .catch((err: unknown) => sendError(res, err));
  });
}
