import { createRoot, type Root } from 'react-dom/client';

import type { AppDependencies } from '@/app/dependencies';
import { Providers } from '@/app/providers';
import { App } from '@/app/shell';

type DependencyFactory = () => AppDependencies;

function StartupFailure() {
  return (
    <main className="flex h-svh items-center justify-center bg-surface-1 p-6 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-title font-semibold">StashBase could not start</h1>
        <p className="mt-2 text-body text-muted-foreground">
          The desktop connection is unavailable. Restart StashBase, or when running from source,
          start the app with <code className="font-mono text-foreground">pnpm dev</code>.
        </p>
      </div>
    </main>
  );
}

export function mountApplication(
  rootElement: HTMLElement,
  createDependencies: DependencyFactory,
): Root {
  const root = createRoot(rootElement);
  try {
    const dependencies = createDependencies();
    root.render(
      <Providers>
        <App dependencies={dependencies} />
      </Providers>,
    );
  } catch (cause) {
    console.error('StashBase renderer startup failed.', cause);
    document.title = 'StashBase — Startup error';
    document.body.dataset.bootSettled = '1';
    root.render(<StartupFailure />);
  }
  return root;
}
