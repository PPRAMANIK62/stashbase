import { AnimatePresence, motion } from 'framer-motion';

import type { SidebarPanelId } from '@/app/composition/commands/use-workspace-commands';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip } from '@/components/ui/tooltip';
import { ChatNavButtons, type AgentWorkspaceRuntime } from '@/features/agent/public';
import {
  DocumentHistoryButtons,
  DocumentTabs,
  useHasOpenDocuments,
  type DocumentTabsRuntime,
} from '@/features/documents/public';
import { NewDraftButton } from '@/features/workspace/public';
import { useIcon } from '@/lib/icon-context';
import { useSizeVariant } from '@/lib/size-context';
import { spring } from '@/lib/springs';

/** The window's title row. Its shared slot shows the open documents' tabs
 *  and otherwise stays empty: the Chat pane names its own conversation in
 *  its header, so the row never has to, and a hidden panel takes the name
 *  away with it. With no folder open there is no workspace on screen at
 *  all, and the row says Welcome instead, which is what is on screen.
 *  The row's left end carries **New draft** in every sidebar state, ahead of
 *  the tabs: it makes a document, and this card is where documents show,
 *  so it does not travel with the sidebar. The expanded sidebar's header
 *  carries the collapse control and the document history's back and
 *  forward; only while the sidebar is collapsed does this titlebar host
 *  them, the reopening trigger and the arrows ahead of New draft, in the
 *  same window corner they left. The chat panel's toggle mirrors that
 *  trigger at the row's far right: the same square in the opposite corner
 *  with the mirrored glyph, present in every folder state so the panel can
 *  always be brought back from where it was hidden, and alone there, so the
 *  corner never changes shape. New chat lives with the conversation, in the
 *  pane's own header, and a hidden pane takes it along. */
export function WorkspaceTitlebar({
  agent,
  chatPaneOpen,
  documents,
  hasActiveFolder,
  onNewDraft,
  onToggleChatPane,
  panel,
}: {
  agent: AgentWorkspaceRuntime;
  chatPaneOpen: boolean;
  documents: DocumentTabsRuntime | null;
  hasActiveFolder: boolean;
  /** Creates an Untitled draft beside the tree's selection and opens it. */
  onNewDraft(): void;
  onToggleChatPane(): void;
  /** The navigator panel the collapsed sidebar was last showing, which is
   *  what the arrows here step: Chats, or else the document history. */
  panel: SidebarPanelId;
}) {
  const PanelRight = useIcon('panel-right');
  const size = useSizeVariant() === 'compact' ? 'icon-compact' : 'icon';
  const chatPaneLabel = chatPaneOpen ? 'Hide chat panel' : 'Show chat panel';
  const hasDocuments = useHasOpenDocuments(documents);
  const { isMobile, open } = useSidebar();
  // While the sidebar is on screen the collapse control lives in its own
  // header; this titlebar hosts the reopening trigger only once the sidebar
  // is away (or renders as a sheet), in the same window corner it left.
  const showsTrigger = isMobile || !open;
  return (
    <header className="workspace-titlebar flex h-11 shrink-0 items-center border-b border-border px-2">
      <div className="workspace-titlebar-controls flex items-center">
        <AnimatePresence initial={false}>
          {showsTrigger && (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex items-center"
              exit={{ opacity: 0, transition: spring.fast.exit }}
              initial={{ opacity: 0 }}
              key="sidebar-controls"
              transition={spring.fast}
            >
              <SidebarTrigger aria-label="Show files sidebar" />
              {hasActiveFolder &&
                (panel === 'chats' ? (
                  <ChatNavButtons runtime={agent} />
                ) : (
                  documents && <DocumentHistoryButtons runtime={documents} />
                ))}
            </motion.div>
          )}
        </AnimatePresence>
        {hasActiveFolder && <NewDraftButton onCreate={onNewDraft} />}
      </div>
      <div className="relative flex min-w-0 flex-1 px-2">
        <AnimatePresence initial={false} mode="popLayout">
          {!hasActiveFolder ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex min-w-0 flex-1 items-center justify-center"
              exit={{ opacity: 0, transition: spring.fast.exit }}
              initial={{ opacity: 0 }}
              key="welcome"
              transition={spring.fast}
            >
              <span className="truncate text-caption font-medium text-foreground">Welcome</span>
            </motion.div>
          ) : documents && hasDocuments ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex min-w-0 flex-1"
              exit={{ opacity: 0, transition: spring.fast.exit }}
              initial={{ opacity: 0 }}
              key="tabs"
              transition={spring.fast}
            >
              <DocumentTabs
                className="workspace-titlebar-controls max-w-full"
                runtime={documents}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {hasActiveFolder ? (
        <div className="workspace-titlebar-controls shrink-0">
          <Tooltip content={chatPaneLabel} side="bottom">
            <Button
              aria-label={chatPaneLabel}
              aria-expanded={chatPaneOpen}
              onClick={onToggleChatPane}
              size={size}
              variant="ghost"
            >
              <PanelRight aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      ) : (
        <div aria-hidden="true" className="size-9 shrink-0" />
      )}
    </header>
  );
}
