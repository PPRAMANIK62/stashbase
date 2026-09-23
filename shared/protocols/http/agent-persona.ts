import { z } from 'zod';

import { AGENT_PERSONA_PRESETS } from '../../agent-persona';

/** A persona always belongs to one project. */
export const agentPersonaScopeSchema = z.object({ kind: z.literal('folder'), path: z.string().min(1) }).strict();

export const agentPersonaChoiceSchema = z.enum([...AGENT_PERSONA_PRESETS, 'custom']);

export const agentPersonaStateSchema = z
  .object({
    custom: z.string(),
    scope: agentPersonaScopeSchema,
    selected: agentPersonaChoiceSchema.nullable(),
  })
  .strip();

/** The write sends the scope as its wire spelling, not as the object the read
 *  answers with. The asymmetry is the route's: it reads a string and
 *  re-derives the scope server-side, which keeps membership authority there
 *  rather than trusting a shape the renderer composed. A write changes the
 *  choice, the custom prompt, or both. */
export const agentPersonaRequestSchema = z
  .object({
    custom: z.string().optional(),
    scope: z.string().min(1),
    selected: agentPersonaChoiceSchema.nullable().optional(),
  })
  .strict()
  .refine((request) => request.selected !== undefined || request.custom !== undefined, {
    message: 'a persona write changes selected, custom, or both',
  });

export type AgentPersonaScopeWire = z.infer<typeof agentPersonaScopeSchema>;
export type AgentPersonaStateWire = z.infer<typeof agentPersonaStateSchema>;
export type AgentPersonaRequestWire = z.infer<typeof agentPersonaRequestSchema>;
