import { vi } from 'vite-plus/test';

import type {
  ExactSearchPort,
  IndexDecisionPort,
  SemanticSearchPort,
} from '@/features/retrieval/application/ports';

export function exactSearchApi(overrides: Partial<ExactSearchPort> = {}): ExactSearchPort {
  return {
    search: vi.fn(async () => ({ files: [], totalMatches: 0, truncated: false })),
    ...overrides,
  };
}

export function semanticSearchApi(overrides: Partial<SemanticSearchPort> = {}): SemanticSearchPort {
  return { search: vi.fn(async () => ({ hits: [], truncated: false })), ...overrides };
}

export function indexDecisionApi(overrides: Partial<IndexDecisionPort> = {}): IndexDecisionPort {
  return {
    decide: vi.fn(async () => undefined),
    dismissWarning: vi.fn(async () => undefined),
    resync: vi.fn(async () => undefined),
    ...overrides,
  };
}
