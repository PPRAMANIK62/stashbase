import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay, Popover } from 'react-aria-components';
import { api, type SessionInfo } from '../../api';
import { EditIcon, HistoryIcon, TrashIcon } from '../../icons';
import { cn } from '../../lib/utils';
import { buttonVariants } from '../ui/button';
import { Input } from '../ui/input';
import { scopeRequestParams, type ChatScope } from './folderState';
import { iconGhostButtonClass } from './panelStyles';
import type { AgentKind } from './types';

const emptyRowClass = 'px-2 py-3.5 text-center text-sm text-muted-foreground';

function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString();
}

export function AgentHistoryMenu({
  open, currentSessionId, agent, scope, onToggle, onClose, onResume, onActiveDeleted,
}: {
  open: boolean;
  currentSessionId: string | null;
  agent: AgentKind;
  /** The tab's currently picked session scope: history lists that scope's
   *  sessions — a folder's conversations, or the library-wide ones. */
  scope: ChatScope;
  onToggle: () => void;
  onClose: () => void;
  onResume: (id: string) => void;
  onActiveDeleted: () => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setLoadError(false);
    try { setSessions(await api.listSessions(agent, scopeRequestParams(scope))); }
    catch { setSessions([]); setLoadError(true); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (open) { void refresh(); }
    else { setQ(''); setEditingId(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh reads the latest scope
  }, [open, agent, scope.kind, scope.kind === 'folder' ? scope.path : '']);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? sessions.filter((s) => s.title.toLowerCase().includes(needle)) : sessions;
  }, [sessions, q]);

  async function commitRename(id: string) {
    const title = editText.trim();
    setEditingId(null);
    if (!title) return;
    try {
      const updated = await api.renameSession(id, title, agent, scopeRequestParams(scope));
      setSessions((ss) => ss.map((s) => (s.id === id ? updated : s)));
    } catch { /* leave list as-is */ }
  }

  async function remove(id: string): Promise<boolean> {
    try { await api.deleteSession(id, agent, scopeRequestParams(scope)); }
    catch {
      setDeleteError('Could not delete this session. Try again.');
      return false;
    }
    setSessions((ss) => ss.filter((s) => s.id !== id));
    if (id === currentSessionId) onActiveDeleted();
    return true;
  }

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && !open) onToggle();
        if (!nextOpen) onClose();
      }}
    >
      <Button className={iconGhostButtonClass} aria-label="Chat history">
        <HistoryIcon />
      </Button>
      <Popover
        className="z-20 w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-pane p-1.5 shadow-elevation"
        placement="bottom end"
      >
        <Dialog aria-label="Chat history">
          <div className="px-0.5 pt-0.5 pb-1.5">
            <Input
              type="text"
              autoFocus
              placeholder="Search sessions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <div className={emptyRowClass}>Loading…</div>}
            {!loading && loadError && <div className={emptyRowClass}>Could not load sessions.</div>}
            {!loading && !loadError && shown.length === 0 && (
              <div className={emptyRowClass}>{q ? 'No matches.' : 'No sessions yet.'}</div>
            )}
            {!loading && shown.map((s) => (
              // Time and hover-revealed actions share the one right-hand
              // slot: time shows at rest, hover/focus swaps in edit/delete.
              <div
                key={s.id}
                className={cn(
                  'group/row relative flex items-center rounded-md hover:bg-muted',
                  s.id === currentSessionId && 'bg-accent/10',
                )}
              >
                {editingId === s.id ? (
                  <input
                    className="mx-1.5 my-1 min-w-0 flex-1 rounded-md border border-accent bg-background px-1.75 py-1 text-base text-foreground outline-none"
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void commitRename(s.id); }
                      else if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => void commitRename(s.id)}
                  />
                ) : (
                  <Button
                    className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 border-0 bg-transparent px-2.25 py-1.75 text-left text-foreground"
                    aria-label={`Resume ${s.title}`}
                    onPress={() => onResume(s.id)}
                  >
                    <span className="min-w-0 flex-1 truncate text-base">{s.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground group-hover/row:hidden group-focus-within/row:hidden">{relTime(s.lastModified)}</span>
                  </Button>
                )}
                <div className="hidden shrink-0 gap-px pr-1.25 group-hover/row:flex group-focus-within/row:flex">
                  <Button
                    className="grid size-6 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground hover:bg-border hover:text-foreground [&_svg]:size-3.75"
                    aria-label={`Rename ${s.title}`}
                    onPress={() => { setEditingId(s.id); setEditText(s.title); }}
                  >
                    <EditIcon />
                  </Button>
                  <DialogTrigger onOpenChange={(isOpen) => { if (isOpen) setDeleteError(null); }}>
                    <Button
                      className="grid size-6 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground hover:bg-border hover:text-foreground [&_svg]:size-3.75"
                      aria-label={`Delete ${s.title}`}
                    >
                      <TrashIcon />
                    </Button>
                    <ModalOverlay className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4" isDismissable>
                      <Modal className="w-[min(360px,100%)] rounded-xl border border-border bg-pane p-4 text-foreground shadow-elevation">
                        <Dialog role="alertdialog" aria-label="Delete chat session">
                          {({ close }) => (
                            <>
                              <Heading slot="title" className="m-0 text-lg font-bold">Delete chat?</Heading>
                              <p className="mt-2 mb-0 text-sm leading-normal text-muted-foreground">Delete “{s.title}”? This cannot be undone.</p>
                              {deleteError && <div className="mt-2 text-sm text-status-danger" role="alert">{deleteError}</div>}
                              <div className="mt-4 flex justify-end gap-2">
                                <Button className={buttonVariants({ variant: 'outline', size: 'sm' })} onPress={close}>Cancel</Button>
                                <Button
                                  className={buttonVariants({ variant: 'destructive', size: 'sm' })}
                                  onPress={() => { void remove(s.id).then((deleted) => { if (deleted) close(); }); }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </>
                          )}
                        </Dialog>
                      </Modal>
                    </ModalOverlay>
                  </DialogTrigger>
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
