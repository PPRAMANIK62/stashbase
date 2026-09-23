import { render } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { CodexIcon, StashBaseIcon } from './agent-marks';

describe('Agent brand icons', () => {
  it('identifies Codex with the familiar OpenAI mark', () => {
    const { container } = render(<CodexIcon size={16} />);
    // The mark is aria-hidden, injected third-party SVG markup (@lobehub/icons-static-svg);
    // its single knot path and inherited color are the recognizable icon contract.
    const svg = container.querySelector('svg'); // dom-contract: injected third-party SVG markup
    expect(svg?.getAttribute('fill')).toBe('currentColor');
    expect(svg?.querySelectorAll('path')).toHaveLength(1); // dom-contract: OpenAI mark shape
    expect(svg?.querySelector('linearGradient')).toBeNull(); // dom-contract: not the Codex badge
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
