import type express from 'express';
import type { AgentPersonaScope } from '../../shared/agent-persona.ts';
import { agentPersonaRequestSchema } from '../../shared/protocols/http/agent-persona.ts';
import { getAgentPersona, setAgentPersona } from '../agent-persona.ts';
import { exactRegisteredFolderRootAsync } from '../folder.ts';
import { filesystemPath } from '../filesystem-path.ts';
import { sendError } from '../http.ts';

function requestError(message: string, status = 400): Error {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

async function resolveScope(value: unknown): Promise<AgentPersonaScope> {
  if (typeof value !== 'string' || !value.trim()) {
    throw requestError('scope must be an absolute project-folder path');
  }
  if (!filesystemPath.isAbsolute(value)) {
    throw requestError('folder scope must be an absolute path');
  }
  const member = await exactRegisteredFolderRootAsync(value);
  if (!member) throw requestError('folder is not in your registered projects', 404);
  return { kind: 'folder', path: member };
}

export function mount(app: express.Express): void {
  app.get('/api/agent-persona', async (req, res) => {
    try {
      res.json(getAgentPersona(await resolveScope(req.query.scope)));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.put('/api/agent-persona', async (req, res) => {
    try {
      const parsed = agentPersonaRequestSchema.safeParse(req.body);
      if (!parsed.success) throw requestError(parsed.error.issues[0]?.message ?? 'invalid persona');
      const { scope: rawScope, ...change } = parsed.data;
      res.json(setAgentPersona(await resolveScope(rawScope), change));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}
