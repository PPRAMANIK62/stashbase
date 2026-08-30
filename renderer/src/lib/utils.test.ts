import { describe, expect, it } from 'vite-plus/test';

import { cn } from '@/lib/utils';

describe('shadcn class composition', () => {
  it('merges conditional classes and resolves Tailwind conflicts', () => {
    expect(cn('px-2', undefined, 'px-4')).toBe('px-4');
  });
});
