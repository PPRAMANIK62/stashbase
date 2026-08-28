import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { withDom } from '@/common/__tests__/renderHarness';
import { EmbeddingAuthChoice } from '@/features/settings/components/embedder/EmbeddingAuthChoice';

test('AI Index setup offers only hosted account and BYOK sources', async () => {
  await withDom(async (dom) => {
    let signIns = 0;
    let keySelections = 0;
    await dom.render(h(EmbeddingAuthChoice, {
      onSignIn: () => { signIns += 1; },
      onUseOwnKey: () => { keySelections += 1; },
    }));

    const buttons = dom.queryAll('button');
    assert.deepEqual(
      buttons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim()),
      [
        'Sign in to StashBaseFree monthly AI Index usage',
        'Use your own API keyOpenAI or OpenRouter',
      ],
    );
    await dom.fire(buttons[0], new MouseEvent('click', { bubbles: true }));
    await dom.fire(buttons[1], new MouseEvent('click', { bubbles: true }));
    assert.equal(signIns, 1);
    assert.equal(keySelections, 1);
    assert.doesNotMatch(dom.html(), /Use this device|local model/i);
  });
});

test('AI Index setup keeps the deliberate skip beside the two source choices', async () => {
  await withDom(async (dom) => {
    let skips = 0;
    await dom.render(h(EmbeddingAuthChoice, {
      onSignIn: () => {},
      onUseOwnKey: () => {},
      onSkip: () => { skips += 1; },
    }));

    const buttons = dom.queryAll('button');
    assert.equal(buttons.length, 3);
    assert.match(buttons[2].textContent ?? '', /Skip AI Index for now/);
    await dom.fire(buttons[2], new MouseEvent('click', { bubbles: true }));
    assert.equal(skips, 1);
  });
});
