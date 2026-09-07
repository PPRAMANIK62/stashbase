import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge's default config has no notion of this project's type-scale
// utilities (text-display/title/subtitle/body/caption, defined via `@utility`
// in globals.css). Without this extension it buckets any of them into the
// same conflict group as text-color utilities (text-foreground,
// text-muted-foreground, text-destructive, ...) purely because both start
// with `text-`, so `cn('text-caption', 'text-muted-foreground')` silently
// drops one of the two — the element falls back to the browser's default
// font size while looking like it has a color class. Registering them as
// their own `font-size` group entries keeps them deduplicating against each
// other and against stock sizes (text-sm, text-lg, ...) while no longer
// colliding with color utilities.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'subtitle', 'body', 'caption'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
