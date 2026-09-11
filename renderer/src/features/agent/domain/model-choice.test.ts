import { describe, expect, it } from 'vite-plus/test';

import { modelChoice } from './model-choice';
import type { AgentModel } from './runtime-catalog';

const NEWEST: AgentModel = {
  defaultEffort: 'medium',
  id: 'gpt-6',
  isDefault: true,
  label: 'GPT-6',
  supportedEfforts: ['low', 'medium', 'high'],
};
const OLDER: AgentModel = {
  defaultEffort: 'low',
  id: 'gpt-5',
  label: 'GPT-5',
  supportedEfforts: ['low', 'high'],
};
const PLAIN: AgentModel = { id: 'mini', label: 'Mini' };

describe('modelChoice', () => {
  it('names the runtime default and its declared effort while nothing is chosen', () => {
    expect(
      modelChoice({ activeModel: null, effort: null, model: null, models: [NEWEST, OLDER] }),
    ).toEqual({ effort: 'medium', efforts: ['low', 'medium', 'high'], model: NEWEST });
  });

  it('prefers the model the runtime reports running over the catalog flag', () => {
    expect(
      modelChoice({ activeModel: 'gpt-5', effort: null, model: null, models: [NEWEST, OLDER] }),
    ).toEqual({ effort: 'low', efforts: ['low', 'high'], model: OLDER });
  });

  it('prefers an explicit pick over both, and an explicit effort over the declared one', () => {
    expect(
      modelChoice({
        activeModel: 'gpt-5',
        effort: 'high',
        model: 'gpt-6',
        models: [NEWEST, OLDER],
      }),
    ).toEqual({ effort: 'high', efforts: ['low', 'medium', 'high'], model: NEWEST });
  });

  it('leaves the choice empty for a runtime that has said nothing', () => {
    expect(
      modelChoice({ activeModel: null, effort: null, model: null, models: [OLDER, PLAIN] }),
    ).toEqual({ effort: null, efforts: [], model: null });
  });

  it('keeps an explicit effort even when no model is known, and ignores a declared default the model cannot run', () => {
    const odd: AgentModel = { ...PLAIN, defaultEffort: 'max', isDefault: true };
    expect(modelChoice({ activeModel: null, effort: 'high', model: null, models: [] })).toEqual({
      effort: 'high',
      efforts: [],
      model: null,
    });
    expect(modelChoice({ activeModel: null, effort: null, model: null, models: [odd] })).toEqual({
      effort: null,
      efforts: [],
      model: odd,
    });
  });
});
