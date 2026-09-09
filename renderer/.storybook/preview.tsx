import type { Decorator, Preview } from '@storybook/react-vite';

import { type SizeVariant } from '../src/lib/size-context';
import {
  applyStoryTheme,
  defaultStoryCanvas,
  StoryFrame,
  type StoryCanvas,
  type StoryTheme,
} from '../src/test/story-canvas';

import '../src/globals.css';

// The stack itself lives in src/test/story-canvas so the accessibility test can
// mount the same one; a story scored under a different stack is not the story
// this canvas shows.
const withFluidEnvironment: Decorator = (Story, context) => {
  applyStoryTheme(context.globals.theme as StoryTheme);

  return (
    <StoryFrame
      canvas={(context.parameters.fluidCanvas as StoryCanvas | undefined) ?? defaultStoryCanvas}
      ownsLandmarks={context.parameters.ownsLandmarks === true}
      size={context.globals.size as SizeVariant}
    >
      <Story />
    </StoryFrame>
  );
};

const preview: Preview = {
  decorators: [withFluidEnvironment],
  globalTypes: {
    theme: {
      description: 'Fluid color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'system', title: 'System', icon: 'browser' },
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    size: {
      description: 'Fluid control density',
      toolbar: {
        title: 'Size',
        icon: 'zoom',
        items: [
          { value: 'default', title: 'Default' },
          { value: 'compact', title: 'Compact' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    size: 'default',
  },
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    a11y: {
      test: 'error',
    },
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: [
          'Overview',
          'Actions',
          'Inputs',
          'Navigation',
          'Overlays',
          'Data Display',
          'Feedback',
          'Compositions',
        ],
      },
    },
  },
};

export default preview;
