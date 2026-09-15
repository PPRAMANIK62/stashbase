import { render } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { CodexIcon, StashBaseIcon } from './agent-marks';

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

  it("paints the StashBase mark at the vendor marks' footprint", () => {
    const { container } = render(<StashBaseIcon size={16} strokeWidth={1.75} />);
    // The recentred box and the thickened strokes are the whole fix, and a
    // caller's icon stroke must not reach the mark, so the attributes the
    // logo renders are the fact under test.
    const svg = container.querySelector('svg'); // dom-contract: the logo renders one svg root
    expect(svg?.getAttribute('viewBox')).toBe('6 -21 512 512');
    expect(svg?.getAttribute('width')).toBe('16');
    const paths = container.querySelectorAll('path'); // dom-contract: logo stroke attributes
    const strokes = [...paths].map((path) => path.getAttribute('stroke-width'));
    expect(strokes).toEqual(['30', '40']);
  });
});
