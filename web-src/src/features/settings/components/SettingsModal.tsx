import { useEffect, useState } from 'react';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { LazyManagedModal } from '@/common/components/LazyManaged';

export type SettingsSection = 'appearance' | 'agents' | 'embedding' | 'transcription' | 'mcp';

export interface SettingsModalProps {
  initialSection: SettingsSection;
  isTopmost: boolean;
  onClose: () => void;
}

interface OpenDetail {
  section?: SettingsSection;
}

const ManagedSettingsModal = lazyWithRetry(() => import('@/features/settings/components/ManagedSettingsModal'));

export function openSettings(section?: SettingsSection): void {
  window.dispatchEvent(
    new CustomEvent<OpenDetail>('stashbase-open-settings', { detail: { section } }),
  );
}

/** Event ownership stays eager; the managed dialog and settings panels load
 * only when Settings is first opened. */
export function SettingsPortal() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('appearance');

  useEffect(() => {
    window.dispatchEvent(new CustomEvent<boolean>('stashbase-overlay-blocking', { detail: open }));
    return () => {
      window.dispatchEvent(new CustomEvent<boolean>('stashbase-overlay-blocking', { detail: false }));
    };
  }, [open]);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<OpenDetail>).detail;
      if (detail?.section) setSection(detail.section);
      setOpen(true);
    }
    window.addEventListener('stashbase-open-settings', onOpen);
    return () => {
      window.removeEventListener('stashbase-open-settings', onOpen);
    };
  }, []);

  if (!open) return null;
  return (
    <LazyManagedModal
      as={ManagedSettingsModal}
      open
      label="Opening Settings…"
      onCancel={() => setOpen(false)}
      componentProps={{ initialSection: section, onClose: () => setOpen(false) }}
    />
  );
}
