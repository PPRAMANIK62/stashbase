import type { Decorator, Preview } from '@storybook/react-vite';

import { AppProviders } from '../src/app/composition/app-providers';
import '../src/foundation.css';
import {
  applyRendererAppearance,
  rendererInterfaceScales,
  rendererThemes,
  resolveRendererAppearance,
} from '../src/shared/styling/appearance';

const withRendererEnvironment: Decorator = (Story, context) => {
  applyRendererAppearance(
    document.documentElement,
    resolveRendererAppearance(context.globals.theme, context.globals.interfaceScale),
  );

  return (
    <AppProviders>
      <Story />
    </AppProviders>
  );
};

const preview: Preview = {
  decorators: [withRendererEnvironment],
  globalTypes: {
    theme: {
      description: 'Production renderer theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: rendererThemes,
        dynamicTitle: true,
      },
    },
    interfaceScale: {
      description: 'Production renderer interface scale',
      toolbar: {
        title: 'Interface scale',
        icon: 'zoom',
        items: rendererInterfaceScales,
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'system',
    interfaceScale: 'default',
  },
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: ['Foundation'],
      },
    },
  },
};

export default preview;
