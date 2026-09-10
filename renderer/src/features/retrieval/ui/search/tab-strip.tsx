import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import type { SemanticReadiness } from '@/features/retrieval/domain/semantic-readiness';

import { backendTabTitle, type SearchBackendRegistry } from './backend';

export interface SearchTabStripProps {
  backends: SearchBackendRegistry;
  onSelect(id: string): void;
  readiness: SemanticReadiness;
  selectedId: string;
}

/** One tab per registered backend, in registry order. */
export function SearchTabStrip({ backends, onSelect, readiness, selectedId }: SearchTabStripProps) {
  const selectedIndex = Math.max(
    0,
    backends.findIndex((backend) => backend.id === selectedId),
  );
  return (
    <TabsSubtle
      aria-label="Search mode"
      onSelect={(index) => {
        const next = backends[index];
        if (next) onSelect(next.id);
      }}
      selectedIndex={selectedIndex}
      size="compact"
    >
      {backends.map((backend) => (
        <TabsSubtleItem
          icon={backend.icon}
          key={backend.id}
          label={backend.label}
          title={backendTabTitle(backend, readiness)}
        />
      ))}
    </TabsSubtle>
  );
}
