import type { EffortLevel } from './types';

export const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

const EFFORT_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
  max: 'Max',
};

export function effortOptions(supported?: readonly string[]): EffortLevel[] {
  return supported?.length ? [...supported] : [...EFFORT_LEVELS];
}

export function effortLabel(effort: EffortLevel): string {
  return EFFORT_LABELS[effort]
    ?? effort
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
