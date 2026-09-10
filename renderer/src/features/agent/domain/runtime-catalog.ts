/** What a runtime says it can offer in this scope: the models a turn can run
 *  on and the skills a prompt can arm. Detail the runtime withheld is a
 *  missing key rather than an undefined one, so a reader tests for it once. */

export interface AgentModel {
  id: string;
  label: string;
  description?: string;
  /** Effort levels this model accepts; a model that names none runs only at
   *  whatever the runtime defaults to. */
  supportedEfforts?: string[];
}

export interface AgentSkill {
  id: string;
  label: string;
  description?: string;
  argumentHint?: string;
}
