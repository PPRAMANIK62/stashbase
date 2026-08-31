import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect fill="#f8fafc" height="512" rx="112" width="512" />
      <g stroke="#6b7280" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16">
        <path d="M92 158v184" />
        <path d="m92 342 164 94" />
      </g>
      <g stroke="#0891b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="20">
        <path d="M92 158 256 64l82 47" />
        <path d="m92 158 164 94 164-94" />
        <path d="M420 158v184" />
        <path d="m256 436 164-94" />
        <path d="M256 342v94" />
      </g>
    </svg>
  );
}
