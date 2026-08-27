import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { withDom } from '@/common/__tests__/renderHarness';
import { EmbeddingAuthChoice } from '@/features/settings/components/embedder/EmbeddingAuthChoice';

test('AI Index setup offers a local model beside hosted and BYOK sources', async () => {
  await withDom(async (dom) => {
    let localSelections = 0;
    await dom.render(h(EmbeddingAuthChoice, {
      onSignIn: () => {},
      onUseOwnKey: () => {},
      onUseLocal: () => { localSelections += 1; },
    }));

    const buttons = dom.queryAll('button');
    assert.deepEqual(
      buttons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim()),
      [
        'Sign in to StashBaseFree monthly AI Index usage',
        'Use this devicePrivate, offline after model setup',
        'Use your own API keyOpenAI or OpenRouter',
      ],
    );
    await dom.fire(buttons[1], new MouseEvent('click', { bubbles: true }));
    assert.equal(localSelections, 1);
    assert.match(dom.html(), /Local mode keeps text on this device/);
  });
});

test('local model setup prevents competing source actions until it settles', async () => {
  await withDom(async (dom) => {
    await dom.render(h(EmbeddingAuthChoice, {
      localBusy: true,
      onSignIn: () => {},
      onUseOwnKey: () => {},
      onUseLocal: () => {},
      onSkip: () => {},
    }));

    const buttons = dom.queryAll('button');
    assert.equal(buttons.length, 4);
    assert.ok(buttons.every((button) => (button as HTMLButtonElement).disabled));
    assert.match(buttons[1].textContent ?? '', /Setting up this device/);
  });
});
