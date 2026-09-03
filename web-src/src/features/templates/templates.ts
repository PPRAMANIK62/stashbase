/** The curated Wiki template set — a local, static list on purpose: v1 is
 * a gallery of PRESETS, not a marketplace with network, accounts, or
 * ratings.
 *
 * Each template is a J12-style complete capability action: `prompt` is the
 * entire visible request placed in the Chat composer — no hidden wire
 * prompt rides along, and Wiki placement /
 * maintenance behavior stays in Agent Instructions (see
 * design-docs/design/agent-panel.md). Keeping every prompt to one plain
 * sentence is a contract, not a style: after the user sends it, the
 * transcript must show the whole instruction the agent received.
 *
 * Two categories split the gallery by where the material comes FROM:
 * `start` templates seed pages for a project that is just beginning, so
 * they ask the agent to CREATE; `organize` templates distill the Sources
 * already in the folder, so they ask it to BUILD OR UPDATE from what is
 * there. Array order is page order within each category; Knowledge Base
 * leads the organize section — it is the classic Build Wiki action.
 */
export type TemplateCategory = 'start' | 'organize';

export interface Template {
  id: string;
  name: string;
  description: string;
  /** The visible preset request this template places as an editable draft. */
  prompt: string;
  category: TemplateCategory;
}

export const TEMPLATES: Template[] = [
  {
    id: 'project-kickoff',
    name: 'Project Kickoff',
    description: 'Starter pages for a project that is just beginning: goals, scope, first decisions, and next steps.',
    prompt: 'Create starter Wiki Pages for this new project: goals, scope, first decisions, and next steps.',
    category: 'start',
  },
  {
    id: 'project-docs',
    name: 'Project Docs',
    description: 'An overview of this project: what it is, how it is structured, and how to work in it.',
    prompt: 'Build or update Wiki Pages documenting this project: overview, structure, and how to work in it.',
    category: 'start',
  },
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'One working page that holds accepted decisions, live alternatives, open questions, and the next focus.',
    prompt: 'Create a Canvas Wiki Page for this project holding accepted decisions, live alternatives, open questions, and next focus.',
    category: 'start',
  },
  {
    id: 'knowledge-base',
    name: 'Knowledge Base',
    description: 'One page per topic across everything in this folder, linked into a browsable wiki.',
    prompt: 'Build or update Wiki Pages from these Sources.',
    category: 'organize',
  },
  {
    id: 'research-notes',
    name: 'Research Notes',
    description: 'Key findings, evidence, and open questions organized out of your source material.',
    prompt: 'Build or update Wiki Pages organizing these Sources into research notes: key findings, supporting evidence, and open questions.',
    category: 'organize',
  },
  {
    id: 'meeting-digest',
    name: 'Meeting Digest',
    description: 'Decisions, action items, and timelines distilled from meeting notes and transcripts.',
    prompt: 'Build or update Wiki Pages digesting the meetings in these Sources: decisions, action items, and timelines.',
    category: 'organize',
  },
  {
    id: 'reading-notes',
    name: 'Reading Notes',
    description: 'One page per source with a summary and the passages worth keeping.',
    prompt: 'Build or update Wiki Pages of reading notes: one page per Source with a summary and notable passages.',
    category: 'organize',
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    description: 'A reference for the code in this folder: modules, interfaces, and how to call them.',
    prompt: 'Build or update Wiki Pages as an API reference for the code in these Sources: modules, interfaces, and usage.',
    category: 'organize',
  },
];
