import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useState, type PropsWithChildren } from 'react';

import { FluidProviders } from '@/lib/runtime/fluid-providers';

/** The app's outer concerns — StrictMode and the query client — wrapped around
 *  the same Fluid stack Storybook and the component tests mount, so a surface
 *  in the running app is the surface those two prove. */
export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <FluidProviders>{children}</FluidProviders>
      </QueryClientProvider>
    </StrictMode>
  );
}
