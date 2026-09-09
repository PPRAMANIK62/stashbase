import { AnimatePresence, motion } from 'framer-motion';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { AgentTitlebar, type AgentWorkspaceRuntime } from '@/features/agent/public';
import {
  DocumentTabs,
  useHasOpenDocuments,
  type DocumentTabsRuntime,
} from '@/features/documents/public';
import { spring } from '@/lib/springs';

/** The window's title row. It shows the open documents' tabs, and hands the
 *  space back to the Agent's own header when the last document closes. */
export function WorkspaceTitlebar({
  agent,
  documents,
}: {
  agent: AgentWorkspaceRuntime;
  documents: DocumentTabsRuntime | null;
}) {
  const hasDocuments = useHasOpenDocuments(documents);
  return (
    <header className="workspace-titlebar flex h-11 shrink-0 items-center border-b border-border px-2">
      <div className="workspace-titlebar-controls">
        <SidebarTrigger aria-label="Toggle files sidebar" />
      </div>
      <div className="relative flex min-w-0 flex-1 px-2">
        <AnimatePresence initial={false} mode="popLayout">
          {documents && hasDocuments ? (
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
