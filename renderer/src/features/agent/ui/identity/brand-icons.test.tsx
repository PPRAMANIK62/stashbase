import { render } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { CodexIcon } from './brand-icons';

describe('Agent brand icons', () => {
  it('gives every inlined mark gradient ids of its own', () => {
    const { container } = render(
      <>
        <CodexIcon size={16} />
        <CodexIcon size={16} />
      </>,
    );
    // The marks are aria-hidden, injected third-party SVG markup (@lobehub/icons-static-svg);
    // gradient id/url wiring is the fact under test, so its DOM shape is the contract.
    const gradients = [...container.querySelectorAll('linearGradient')].map((node) => node.id); // dom-contract: injected third-party SVG markup
    expect(gradients).toHaveLength(2);
    expect(new Set(gradients).size).toBe(2);
    const svgs = container.querySelectorAll('svg'); // dom-contract: injected third-party SVG markup
    for (const svg of svgs) {
      const id = svg.querySelector('linearGradient')?.id; // dom-contract: injected third-party SVG markup
      expect(id).toMatch(/^lobe-icons-codex-/u);
      expect(svg.innerHTML).toContain(`url(#${id})`);
    }
  });
});
