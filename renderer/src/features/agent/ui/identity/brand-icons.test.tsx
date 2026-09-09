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
    const gradients = [...container.querySelectorAll('linearGradient')].map((node) => node.id);
    expect(gradients).toHaveLength(2);
    expect(new Set(gradients).size).toBe(2);
    for (const svg of container.querySelectorAll('svg')) {
      const id = svg.querySelector('linearGradient')?.id;
      expect(id).toMatch(/^lobe-icons-codex-/u);
      expect(svg.innerHTML).toContain(`url(#${id})`);
    }
  });
});
