/** A new draft is always available, even before Agent sign-in or setup. */
import { MessageCirclePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentCatalogPort } from '@/features/agent/application/ports';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import type { AgentScope } from '@/features/agent/domain/session';

export function NewChatButton({
  runtime,
  scope,
}: {
  catalog: AgentCatalogPort;
  runtime: AgentWorkspaceRuntime;
  scope: AgentScope;
}) {
  return (
    <Tooltip content="New chat" side="bottom">
      <Button
        aria-label="New chat"
        onClick={() => {
          runtime.newChat(undefined, scope);
        }}
        // The compact square: 28px around a 14px glyph, the same box and
        // weight as the Markdown viewer's Writer and Reading items across the
        // seam, so the three read as one family on one line.
        size="icon-compact"
        variant="ghost"
      >
        <MessageCirclePlus aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
