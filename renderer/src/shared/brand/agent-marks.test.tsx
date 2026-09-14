import { render } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { CodexIcon, OpenQuillIcon } from './agent-marks';

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

  it("paints the OpenQuill feather at the vendor marks' footprint", () => {
    const { container } = render(<OpenQuillIcon size={16} />);
    // The feather is lucide's own svg; the widened box is the whole fix, so
    // the attribute is the fact under test.
    const svg = container.querySelector('svg'); // dom-contract: lucide renders one svg root
    expect(svg?.getAttribute('viewBox')).toBe('-4 -4 32 32');
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('stroke-width')).toBe('2.5');
  });
});
