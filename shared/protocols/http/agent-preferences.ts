import { z } from 'zod';
import { agentIdSchema } from './agent-runtime';

const effortSchema = z.string().min(1).max(64).nullable();
export const projectAgentPreferenceUpdateSchema = z.object({
  scope: z.string().min(1).max(4096),
  agent: agentIdSchema,
  effort: effortSchema.optional(),
});
export const projectAgentPreferenceSchema = z.object({
  scope: z.string().min(1).max(4096),
  agent: agentIdSchema,
  efforts: z.object({
    stashbase: effortSchema.optional(),
    codex: effortSchema.optional(),
    claude: effortSchema.optional(),
  }).optional(),
});
export const agentPreferencesSchema = z.array(projectAgentPreferenceSchema);
