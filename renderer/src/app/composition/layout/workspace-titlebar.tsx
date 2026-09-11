import { AnimatePresence, motion } from 'framer-motion';

import { useDependencies } from '@/app/composition/dependency-context';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  AgentTitlebar,
  NewChatButton,
  type AgentScope,
  type AgentWorkspaceRuntime,
} from '@/features/agent/public';
import {
  DocumentTabs,
  useHasOpenDocuments,
  type DocumentTabsRuntime,
} from '@/features/documents/public';
import { spring } from '@/lib/springs';

/** The window's title row. It shows the open documents' tabs, and hands the
 *  space back to the Agent's own header when the last document closes. With
 *  no folder open the Agent workspace is off screen, so naming its blank chat
 *  here would point at something the reader cannot see; the row says
 *  Welcome instead, which is what is on screen. While a folder is open, a
 *  new-chat button sits beside the sidebar toggle so a fresh conversation is
 *  one click away from anywhere in the window. */
export function WorkspaceTitlebar({
  agent,
  documents,
  hasActiveFolder,
  scope,
}: {
  agent: AgentWorkspaceRuntime;
  documents: DocumentTabsRuntime | null;
  hasActiveFolder: boolean;
  scope: AgentScope;
}) {
  const dependencies = useDependencies();
  const hasDocuments = useHasOpenDocuments(documents);
  return (
    <header className="workspace-titlebar flex h-11 shrink-0 items-center border-b border-border px-2">
      <div className="workspace-titlebar-controls flex items-center gap-1">
        <SidebarTrigger aria-label="Toggle files sidebar" />
        {hasActiveFolder && (
          <NewChatButton catalog={dependencies.agent.catalog} runtime={agent} scope={scope} />
        )}
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
          ) : (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex min-w-0 flex-1"
              exit={{ opacity: 0, transition: spring.fast.exit }}
              initial={{ opacity: 0 }}
              key="agent"
              transition={spring.fast}
            >
              <AgentTitlebar runtime={agent} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div aria-hidden="true" className="size-9 shrink-0" />
    </header>
  );
}
