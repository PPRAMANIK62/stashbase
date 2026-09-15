import type { LocalComponentPort } from '@/features/settings/application/ports';
import { useLocalComponent } from '@/features/settings/hooks/use-local-component';

import { LocalComponentGroup } from './local-component-group';

/** Shown only beside a source waiting for the shared PDF/OCR component. */
export function LocalComponentRecovery({ port }: { port?: LocalComponentPort | undefined }) {
  const model = useLocalComponent(port, true);
  if (!model || (model.status !== 'failed' && model.status !== 'downloading' && !model.failure))
    return null;
  return (
    <div className="shrink-0 border-b border-border p-3">
      <LocalComponentGroup model={model} />
    </div>
  );
}
