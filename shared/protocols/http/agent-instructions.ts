import { z } from 'zod';

/** The scope an instructions read or write is about: one library folder, or
 *  the Library as a whole for a Chat with no working folder. */
export const agentInstructionsScopeSchema = z.union([
  z.object({ kind: z.literal('library') }).strict(),
  z.object({ kind: z.literal('folder'), path: z.string().min(1) }).strict(),
]);

export const agentInstructionsStateSchema = z
  .object({
    /** True when the text is the reader's own rather than the packaged
     *  default, which is what the presence indicator reports. */
    customized: z.boolean(),
    scope: agentInstructionsScopeSchema,
    text: z.string(),
  })
  .strip();

/** The write sends the scope as its wire spelling, not as the object the read
 *  answers with. The asymmetry is the route's: `resolveScope` reads a string
 *  and re-derives the scope server-side, which keeps membership authority
 *  there rather than trusting a shape the renderer composed. */
export const agentInstructionsRequestSchema = z
  .object({ scope: z.string().min(1), text: z.string() })
  .strict();

export type AgentInstructionsScopeWire = z.infer<typeof agentInstructionsScopeSchema>;
export type AgentInstructionsStateWire = z.infer<typeof agentInstructionsStateSchema>;
