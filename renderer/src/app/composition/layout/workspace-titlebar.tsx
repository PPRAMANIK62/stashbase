import { AnimatePresence, motion } from 'framer-motion';

import { useDependencies } from '@/app/composition/dependency-context';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip } from '@/components/ui/tooltip';
import {
  NewChatButton,
  type AgentScope,
  type AgentWorkspaceRuntime,
} from '@/features/agent/public';
import {
  DocumentTabs,
  useHasOpenDocuments,
  type DocumentTabsRuntime,
} from '@/features/documents/public';
import { useIcon } from '@/lib/icon-context';
import { useSizeVariant } from '@/lib/size-context';
import { spring } from '@/lib/springs';

/** The window's title row. Its shared slot shows the open documents' tabs
 *  and otherwise stays empty: the Chat pane names its own conversation in
 *  its header, so the row never has to, and a hidden panel takes the name
 *  away with it. With no folder open there is no workspace on screen at
 *  all, and the row says Welcome instead, which is what is on screen.
 *  The expanded sidebar's header
 *  carries the collapse control and the new-chat button; only while the
 *  sidebar is collapsed does this titlebar host them — the reopening
 *  trigger with, while a folder is open, new-chat beside it — in the same
 *  window corner they left. The chat panel's toggle mirrors that trigger at
 *  the row's far right: the same square in the opposite corner with the
 *  mirrored glyph, present in every folder state so the panel can always be
 *  brought back from where it was hidden. */
export function WorkspaceTitlebar({
  agent,
  chatPaneOpen,
  onToggleChatPane,
  documents,
  hasActiveFolder,
  scope,
}: {
  agent: AgentWorkspaceRuntime;
  chatPaneOpen: boolean;
  onToggleChatPane(): void;
  documents: DocumentTabsRuntime | null;
  hasActiveFolder: boolean;
  scope: AgentScope;
}) {
  const dependencies = useDependencies();
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
              {hasActiveFolder && (
                <NewChatButton catalog={dependencies.agent.catalog} runtime={agent} scope={scope} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
