/** The StashBase mark.
 *
 *  The three colours are brand tokens (`--brand-*` in globals.css) rather than
 *  literals: the mark is only ever rendered inside the app, so it inherits the
 *  stylesheet, and keeping the values with the rest of the palette means a
 *  brand change is one edit. It is deliberately theme-independent — an
 *  identity, not a surface — so the tokens carry no light-dark() pair. */

import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect fill="var(--brand-ground)" height="512" rx="112" width="512" />
      <g stroke="var(--brand-frame)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16">
        <path d="M92 158v184" />
        <path d="m92 342 164 94" />
      </g>
      <g stroke="var(--brand-accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="20">
        <path d="M92 158 256 64l82 47" />
        <path d="m92 158 164 94 164-94" />
        <path d="M420 158v184" />
        <path d="m256 436 164-94" />
        <path d="M256 342v94" />
      </g>
    </svg>
  );
}
