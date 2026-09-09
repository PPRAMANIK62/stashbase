import axe from 'axe-core';
import { expect } from 'vite-plus/test';

/** Rules that cannot mean anything in a headless DOM fragment. happy-dom
 *  computes no layout or paint, so contrast is unmeasurable; a component
 *  test renders one primitive rather than a page, so there is no landmark
 *  for `region` to find. Everything else runs. */
const HEADLESS_RULES = {
  'color-contrast': { enabled: false },
  region: { enabled: false },
} as const;

/** Fails with the offending rules and the nodes that broke them. */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: HEADLESS_RULES });
  const described = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.html).join(', ')})`,
  );
  expect(described).toEqual([]);
}
