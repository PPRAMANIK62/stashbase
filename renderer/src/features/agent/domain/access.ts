/** How much a turn may do on its own. The composer offers these four modes,
 *  a session carries the one in force, and the transport's spelling of them
 *  is mapped in `infrastructure/session-api`. */
export type AgentAccessMode = 'default' | 'acceptEdits' | 'plan' | 'auto';
