/** Templates — the gallery of preset wiki activations (a singleton
 * `kind: 'templates'` workspace tab; see design-docs/design/
 * agent-panel.md for the product contract).
 *
 * The view is exported pre-wrapped in `lazyWithRetry`, the same shape the
 * agent panel gives `ChatPane`: the gallery is a destination most sessions
 * never open, so the barrel is what keeps it out of the initial chunk —
 * callers render it inside their own `LazyLoadBoundary`/`Suspense`. */
import { lazyWithRetry } from '@/common/components/ErrorBoundary';

export const TemplatesView = lazyWithRetry(() =>
  import('@/features/templates/TemplatesView'));

export { TEMPLATES, type Template } from './templates';
