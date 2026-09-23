/** A persona belongs to one project. */
export type AgentPersonaScope = { kind: 'folder'; path: string };

/** The packaged personas, in the order the picker lists them. Their prompts
 *  are product content in `assets/agent-personas/<id>.md`. */
export const AGENT_PERSONA_PRESETS = ['marketer', 'journalist', 'storyteller'] as const;

export type AgentPersonaPreset = (typeof AGENT_PERSONA_PRESETS)[number];

/** `custom` is the reader's own prompt for this project. */
export type AgentPersonaChoice = AgentPersonaPreset | 'custom';

export interface AgentPersonaState {
  scope: AgentPersonaScope;
  /** The persona new sessions in this project run under; null runs none. */
  selected: AgentPersonaChoice | null;
  /** The reader's own persona prompt, kept while another persona is chosen. */
  custom: string;
}

export function isAgentPersonaChoice(value: unknown): value is AgentPersonaChoice {
  return value === 'custom' || (AGENT_PERSONA_PRESETS as readonly unknown[]).includes(value);
}

/** Large enough for a detailed persona, bounded so one setting cannot
 * dominate every Agent prompt or make config.json grow without limit. */
export const MAX_AGENT_PERSONA_LENGTH = 32_000;
