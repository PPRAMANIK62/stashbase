import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode, type PropsWithChildren, useState } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { IconProvider } from '@/lib/icon-context';
import { ShapeProvider } from '@/lib/shape-context';
import { SizeProvider } from '@/lib/size-context';
import { SurfaceProvider } from '@/lib/surface-context';

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
        <MotionConfig reducedMotion="user">
          <ShapeProvider defaultShape="rounded">
            <SizeProvider defaultSize="default">
              <SurfaceProvider value={1}>
                <IconProvider>
                  <TooltipProvider>{children}</TooltipProvider>
                </IconProvider>
              </SurfaceProvider>
            </SizeProvider>
          </ShapeProvider>
        </MotionConfig>
      </QueryClientProvider>
    </StrictMode>
  );
}
