import { z } from 'zod';
import { agentIdSchema } from './agent-runtime';

export const projectAgentPreferenceSchema = z.object({
  scope: z.string().min(1).max(4096),
  agent: agentIdSchema,
});
export const agentPreferencesSchema = z.array(projectAgentPreferenceSchema);
