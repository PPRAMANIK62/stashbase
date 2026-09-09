/** Holds the two spellings of the same token together.
 *
 *  Three ladders are written twice: once in TypeScript, where components read
 *  them, and once in `globals.css`, where plain CSS and the class-driven
 *  utilities read them. Motion steps are `springs.ts` and `--motion-*`; the
 *  input radius is `shape-context.ts` and `--shape-input-radius`; the type
 *  steps are `size-context.tsx` and `--fs-*`. Until now the only thing keeping
 *  the pairs equal was a comment on each side asking a reader to remember, and
 *  a drift would surface as a class transition landing a frame off a spring,
 *  or a focus ring whose corners miss the field's.
 *
 *  So the CSS is parsed and compared. The declarations are read out of the
 *  block each one actually lives in rather than by first match, because the
 *  reduced-motion media query re-declares the motion steps as 1ms and the
 *  compact step re-declares every `--fs-*`.
 *
 *  The focus ring is the fourth pair and the odd one: the TypeScript side is
 *  a literal colour rather than a step, kept as the fallback a copied
 *  primitive draws with. A fallback that stopped matching the token would be
 *  invisible until someone removed the token. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vite-plus/test';

import { FOCUS_RING_FALLBACK } from '@/lib/focus-ring';
import { shapeTokens } from '@/lib/shape-context';
import { sizeMap, type SizeVariant } from '@/lib/size-context';
import { stepMs } from '@/lib/springs';

const stylesheet = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../globals.css'),
  'utf8',
);

/** The declaration block that contains `marker` — a declaration unique to the
 *  block being asked for. Both ends are brace-matched: scanning backwards past
 *  a closed sibling rule would otherwise mistake that rule's opening brace for
 *  this block's, and a nested rule inside would otherwise end it early. */
function blockContaining(marker: string): string {
  const at = stylesheet.indexOf(marker);
  expect(at, `globals.css declares ${marker}`).toBeGreaterThan(-1);
  let depth = 0;
  let open = -1;
  for (let index = at; index >= 0; index -= 1) {
    if (stylesheet[index] === '}') depth += 1;
    else if (stylesheet[index] === '{') {
      if (depth === 0) {
        open = index;
        break;
      }
      depth -= 1;
    }
  }
  expect(open, `${marker} sits inside a declaration block`).toBeGreaterThan(-1);
  depth = 0;
  for (let index = open; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === '{') depth += 1;
    else if (stylesheet[index] === '}') {
      depth -= 1;
      if (depth === 0) return stylesheet.slice(open + 1, index);
    }
  }
  throw new Error(`unterminated block around ${marker}`);
}

/** A custom property's value, in the numeric unit it is declared with. */
function customProperty(block: string, name: string): number {
  const match = new RegExp(`${name}:\\s*(-?[\\d.]+)(ms|px)\\s*;`).exec(block);
  expect(match, `${name} is declared as a numeric ms/px value`).not.toBeNull();
  return Number(match?.[1]);
}

/** The pixel size a `text-[13px]` ladder class stands for. */
function ladderPx(className: string): number {
  const match = /^text-\[(\d+)px\]$/.exec(className);
  expect(match, `${className} is an arbitrary px type step`).not.toBeNull();
  return Number(match?.[1]);
}

describe('motion steps', () => {
  const motion = blockContaining('--motion-fast:');

  it.each([
    ['fast', '--motion-fast'],
    ['base', '--motion-base'],
    ['slow', '--motion-slow'],
  ] as const)('publishes the %s step to CSS unchanged', (step, property) => {
    expect(customProperty(motion, property)).toBe(stepMs[step]);
  });

  it('zeroes every step under the reduced-motion query', () => {
    // Not a parity check but the other half of the contract: a step that
    // gained a CSS spelling without a reduced-motion counterpart would keep
    // animating for a viewer who asked it not to.
    const reduced = blockContaining('--motion-fast: 1ms');
    for (const property of ['--motion-fast', '--motion-base', '--motion-slow']) {
      expect(customProperty(reduced, property)).toBe(1);
    }
  });
});

describe('shape', () => {
  it('publishes the input radius to CSS unchanged', () => {
    const radius = customProperty(blockContaining('--shape-input-radius:'), '--shape-input-radius');
    expect(radius).toBe(shapeTokens.bgRadius);
    expect(radius).toBe(shapeTokens.mergedRadius);
  });
});

describe('focus ring', () => {
  it('gives the copied-primitive fallback the same colour as the token', () => {
    const declared = /--focus-ring:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(stylesheet)?.[1];
    const fallback = /#[0-9a-fA-F]{3,8}/.exec(FOCUS_RING_FALLBACK)?.[0];
    expect(declared, 'globals.css declares --focus-ring as a hex colour').toBeDefined();
    expect(fallback, 'lib/focus-ring.ts writes the fallback as a hex colour').toBeDefined();
    expect(fallback?.toLowerCase()).toBe(declared?.toLowerCase());
  });
});

describe('type steps', () => {
  const scopes: Record<SizeVariant, string> = {
    default: blockContaining('--fs-body: 13px'),
    compact: blockContaining('--fs-body: 12px'),
  };

  it('keys the compact scope on the attribute SizeProvider stamps', () => {
    // The compact `--fs-*` block is only reachable because lib/size-context's
    // outermost provider writes `data-size` on <html>. If either side renames
    // its half, `text-caption` silently stops following `sizeClasses.caption`
    // and every row below still passes.
    expect(stylesheet).toContain("html[data-size='compact']");
    const provider = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'size-context.tsx'),
      'utf8',
    );
    expect(provider).toContain('root.dataset.size = size');
  });

  it.each(['default', 'compact'] as const)('publishes the %s body step to CSS', (variant) => {
    expect(customProperty(scopes[variant], '--fs-body')).toBe(ladderPx(sizeMap[variant].text));
  });

  it.each(['default', 'compact'] as const)('publishes the %s caption step to CSS', (variant) => {
    expect(customProperty(scopes[variant], '--fs-caption')).toBe(
      ladderPx(sizeMap[variant].caption),
    );
  });

  it('keeps the two steps one notch apart at both ends of the ladder', () => {
    // The pairs above would still pass if `text` and `caption` were equal;
    // the ladder is a ladder because the steps differ.
    for (const variant of ['default', 'compact'] as const) {
      expect(ladderPx(sizeMap[variant].text)).toBeGreaterThan(ladderPx(sizeMap[variant].caption));
    }
    expect(ladderPx(sizeMap.default.text)).toBeGreaterThan(ladderPx(sizeMap.compact.text));
  });
});
