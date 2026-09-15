import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type { McpAccessPort } from '@/features/settings/application/ports';

import { AiIndexPanel } from './ai-index/ai-index-panel';
import { McpAccessPanel } from './mcp/mcp-access-panel';
import { SettingsList, SettingsPane, SettingsRow } from './rows';

export function AdvancedPanel({
  embedderApi,
  mcpAccessApi,
  initialPage = null,
}: {
  embedderApi?: EmbedderPort | undefined;
  mcpAccessApi?: McpAccessPort | undefined;
  initialPage?: 'search' | 'mcp' | null;
}) {
  const [page, setPage] = useState(initialPage);
  const content =
    page === 'search' && embedderApi ? (
      <AiIndexPanel embedderApi={embedderApi} />
    ) : page === 'mcp' && mcpAccessApi ? (
      <McpAccessPanel mcpAccessApi={mcpAccessApi} />
    ) : null;
  if (content)
    return (
      <div className="flex flex-col gap-3">
        {/* The way back is navigation, not an action: an arrow, and its box on
            the pane's own left edge so the label below it starts where the
            title does. Padding rather than a negative margin, so the hover
            pill stops at that edge too. */}
        <Button
          className="self-start px-1.5"
          leadingIcon={ArrowLeft}
          onClick={() => setPage(null)}
          size="compact"
          variant="ghost"
        >
          Back to Advanced
        </Button>
        {content}
      </div>
    );
  return (
    <SettingsPane title="Advanced">
      <SettingsList>
        <SettingsRow
          title="Search by Meaning"
          detail="Use your own API key for search by meaning."
          trail={
            <Button
              disabled={!embedderApi}
              variant="tertiary"
              size="compact"
              onClick={() => setPage('search')}
            >
              Configure search
            </Button>
          }
        />
        <SettingsRow
          title="External apps (MCP)"
          detail="Connect other AI apps to your projects."
          trail={
            <Button
              disabled={!mcpAccessApi}
              variant="tertiary"
              size="compact"
              onClick={() => setPage('mcp')}
            >
              Configure connection
            </Button>
          }
        />
      </SettingsList>
    </SettingsPane>
  );
}
