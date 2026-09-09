/** The environment a story is designed to be read in, so that the two places
 *  that mount stories mount the same one.
 *
 *  Storybook's preview decorator and the accessibility test that scores every
 *  story both need the provider stack, the theme on `<html>`, and the bounded
 *  canvas the story was composed against. When each built its own, the test's
 *  claim to be scoring "the story anyone sees" was a comment rather than a
 *  fact — a story could pass the test under a stack the canvas never uses.
 *  Both import this.
 *
 *  The canvas is a `<main>` on purpose: a story is the whole of its page while
 *  it is on screen, and content outside a landmark is a real finding, so the
 *  frame gives the story one instead of the score having to look away. A story
 *  that composes a whole page skeleton brings its own landmarks and says so
 *  (`parameters.ownsLandmarks`), because a `<main>` nested inside another one
 *  is itself a finding. */

'use client';

import { type ReactNode } from 'react';

import { FluidProviders } from '@/lib/runtime/fluid-providers';
import { type SizeVariant } from '@/lib/size-context';

export type StoryTheme = 'system' | 'light' | 'dark';

/** The box a story is composed inside — width and minimum height. A story
 *  declares its own through `parameters.fluidCanvas`. */
export interface StoryCanvas {
  width: string;
  minHeight: string;
}

export const defaultStoryCanvas: StoryCanvas = { width: '28rem', minHeight: '9rem' };

/** Pins the colour scheme on `<html>`, where the token block resolves
 *  `light-dark()` — a class on the frame would leave portalled surfaces (which
 *  render into `<body>`) on the other theme. */
export function applyStoryTheme(theme: StoryTheme): void {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme === 'system' ? 'light dark' : theme;
}

export interface StoryFrameProps {
  size: SizeVariant;
  canvas?: StoryCanvas;
  /** The story renders its own page landmarks (a full shell composition), so
   *  the frame steps down to a plain box rather than nesting a second `<main>`
   *  around them. @default false */
  ownsLandmarks?: boolean;
  children: ReactNode;
}

const FRAME_CLASS =
  'mx-auto flex max-w-full items-center justify-center overflow-visible rounded-xl border border-border bg-background p-6 text-foreground shadow-sm';

/** The provider stack plus the bounded canvas, exactly as the preview renders
 *  it. */
export function StoryFrame({
  size,
  canvas = defaultStoryCanvas,
  ownsLandmarks = false,
  children,
}: StoryFrameProps) {
  const frameStyle = { minHeight: canvas.minHeight, width: canvas.width };
  return (
    <FluidProviders size={size}>
      <div className="w-full p-6">
        {ownsLandmarks ? (
          <div className={FRAME_CLASS} style={frameStyle}>
            {children}
          </div>
        ) : (
          <main className={FRAME_CLASS} style={frameStyle}>
            {children}
          </main>
        )}
      </div>
    </FluidProviders>
  );
}
