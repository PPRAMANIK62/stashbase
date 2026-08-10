import { lazy, Suspense } from 'react';

const MotionDropVeil = lazy(() => import('./MotionDropVeil'));

/** Drag-import veil. Visibility flows from the global drag handler in
 *  the parent (`useGlobalDragDrop`) via the `hot` prop. Motion is loaded only
 *  when a drag begins, so an optional visual enhancement does not tax startup. */
export function DropVeil({ hot }: { hot: boolean }) {
  if (!hot) return null;
  return (
    <Suspense fallback={<div className="drop-veil hot">Release to import</div>}>
      <MotionDropVeil />
    </Suspense>
  );
}
