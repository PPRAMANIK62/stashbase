import { useState, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import type { SettingsDialogProps, SettingsSection } from './SettingsModal';
import { AppearancePanel } from './settings/AppearancePanel';
import { EmbeddingPanel } from './settings/EmbeddingPanel';
import { McpClientsPanel } from './settings/McpClientsPanel';
import { TranscriptionPanel } from './settings/TranscriptionPanel';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

const SECTIONS: { id: SettingsSection; label: string; render: () => ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', render: () => <AppearancePanel /> },
  { id: 'embedding', label: 'Embedding', render: () => <EmbeddingPanel /> },
  { id: 'transcription', label: 'Transcription', render: () => <TranscriptionPanel /> },
  { id: 'mcp', label: 'MCP', render: () => <McpClientsPanel /> },
];

export default function ManagedSettingsDialog({
  initialSection,
  isTopmost,
  onClose,
}: SettingsDialogProps) {
  const [current, setCurrent] = useState<SettingsSection>(initialSection);
  const active = SECTIONS.find((section) => section.id === current) ?? SECTIONS[0];

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && isTopmost) onClose();
      }}
    >
      <DialogContent
        className="modal-card settings-card !max-w-[94vw] !gap-0"
        showCloseButton={false}
      >
        <div className="settings-header">
          <DialogTitle>Settings</DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="settings-close"
            aria-label="Close settings"
            onClick={onClose}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav" role="tablist" aria-orientation="vertical">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={section.id === current}
                className={'settings-nav-item' + (section.id === current ? ' current' : '')}
                onClick={() => setCurrent(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div className="settings-content" role="tabpanel">
            {active.render()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
