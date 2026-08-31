import { MotionConfig } from 'framer-motion';
import { StrictMode, type PropsWithChildren } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { IconProvider } from '@/lib/icon-context';
import { ShapeProvider } from '@/lib/shape-context';
import { SizeProvider } from '@/lib/size-context';
import { SurfaceProvider } from '@/lib/surface-context';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <StrictMode>
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
    </StrictMode>
  );
}
