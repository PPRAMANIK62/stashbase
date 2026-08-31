import type { Decorator, Preview } from '@storybook/react-vite';
import { MotionConfig } from 'framer-motion';

import { TooltipProvider } from '../src/components/ui/tooltip';
import { IconProvider } from '../src/lib/icon-context';
import { ShapeProvider } from '../src/lib/shape-context';
import { SizeProvider, type SizeVariant } from '../src/lib/size-context';
import { SurfaceProvider } from '../src/lib/surface-context';

import '../src/globals.css';

type Theme = 'system' | 'light' | 'dark';

type FluidCanvas = {
  width: string;
  minHeight: string;
};

const defaultCanvas: FluidCanvas = { width: '28rem', minHeight: '9rem' };

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
}

const withFluidEnvironment: Decorator = (Story, context) => {
  const theme = context.globals.theme as Theme;
  const size = context.globals.size as SizeVariant;
  const canvas = (context.parameters.fluidCanvas as FluidCanvas | undefined) ?? defaultCanvas;

  applyTheme(theme);

  return (
    <MotionConfig reducedMotion="user">
      <ShapeProvider defaultShape="rounded">
        <SizeProvider size={size}>
          <SurfaceProvider value={1}>
            <IconProvider>
              <TooltipProvider>
                <div className="w-full p-6">
                  <div
                    className="mx-auto flex max-w-full items-center justify-center overflow-visible rounded-xl border border-border bg-background p-6 text-foreground shadow-sm"
                    style={{ minHeight: canvas.minHeight, width: canvas.width }}
                  >
                    <Story />
                  </div>
                </div>
              </TooltipProvider>
            </IconProvider>
          </SurfaceProvider>
        </SizeProvider>
      </ShapeProvider>
    </MotionConfig>
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
