import { createContext, use, type PropsWithChildren } from 'react';

import type { AppDependencies } from '@/app/dependencies';

const DependencyContext = createContext<AppDependencies | null>(null);

/** The resolved adapter record, published once for the window.
 *
 *  Binder components below the layout each need two or three ports; threading
 *  every one of them through the layout made arrangement carry wiring it never
 *  looks at. The record is built once at startup and never replaced, so
 *  publishing it here costs no render and lets each binder take exactly what
 *  it uses. */
export function DependencyProvider({
  children,
  dependencies,
}: PropsWithChildren<{ dependencies: AppDependencies }>) {
  return <DependencyContext value={dependencies}>{children}</DependencyContext>;
}

export function useDependencies(): AppDependencies {
  const dependencies = use(DependencyContext);
  if (!dependencies) {
    throw new Error('Workspace composition must be rendered inside a DependencyProvider.');
  }
  return dependencies;
}
