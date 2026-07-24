import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay, Popover } from 'react-aria-components';
import { api, type SessionInfo } from '../../api';
import { EditIcon, HistoryIcon, TrashIcon } from '../../icons';
import type { AgentKind } from './types';

function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString();
}

export function AgentHistoryMenu({
  open, currentSessionId, agent, onToggle, onClose, onResume, onActiveDeleted,
}: {
  open: boolean;
  currentSessionId: string | null;
  agent: AgentKind;
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
    try { setSessions(await api.listSessions(agent)); }
    catch { setSessions([]); setLoadError(true); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (open) { void refresh(); }
    else { setQ(''); setEditingId(null); }
  }, [open, agent]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? sessions.filter((s) => s.title.toLowerCase().includes(needle)) : sessions;
  }, [sessions, q]);

  async function commitRename(id: string) {
    const title = editText.trim();
    setEditingId(null);
    if (!title) return;
    try {
      const updated = await api.renameSession(id, title, agent);
      setSessions((ss) => ss.map((s) => (s.id === id ? updated : s)));
    } catch { /* leave list as-is */ }
  }

  async function remove(id: string): Promise<boolean> {
    try { await api.deleteSession(id, agent); }
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
      <Button className="agent-head-btn" aria-label="Chat history">
        <HistoryIcon />
      </Button>
      <Popover className="agent-history-menu" placement="bottom end">
        <Dialog aria-label="Chat history">
          <div className="agent-history-search">
            <input
              type="text"
              autoFocus
              placeholder="Search sessions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="agent-history-list">
            {loading && <div className="agent-history-empty">Loading…</div>}
            {!loading && loadError && <div className="agent-history-empty">Could not load sessions.</div>}
            {!loading && !loadError && shown.length === 0 && (
              <div className="agent-history-empty">{q ? 'No matches.' : 'No sessions yet.'}</div>
            )}
            {!loading && shown.map((s) => (
              <div
                key={s.id}
                className={'agent-history-row' + (s.id === currentSessionId ? ' active' : '')}
              >
                {editingId === s.id ? (
                  <input
                    className="agent-history-rename"
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
                    className="agent-history-open"
                    aria-label={`Resume ${s.title}`}
                    onPress={() => onResume(s.id)}
                  >
                    <span className="agent-history-title">{s.title}</span>
                    <span className="agent-history-time">{relTime(s.lastModified)}</span>
                  </Button>
                )}
                <div className="agent-history-row-actions">
                  <Button
                    className="agent-history-act"
                    aria-label={`Rename ${s.title}`}
                    onPress={() => { setEditingId(s.id); setEditText(s.title); }}
                  >
                    <EditIcon />
                  </Button>
                  <DialogTrigger onOpenChange={(isOpen) => { if (isOpen) setDeleteError(null); }}>
                    <Button className="agent-history-act" aria-label={`Delete ${s.title}`}>
                      <TrashIcon />
                    </Button>
                    <ModalOverlay className="agent-history-confirm-overlay" isDismissable>
                      <Modal className="agent-history-confirm">
                        <Dialog role="alertdialog" aria-label="Delete chat session">
                          {({ close }) => (
                            <>
                              <Heading slot="title">Delete chat?</Heading>
                              <p>Delete “{s.title}”? This cannot be undone.</p>
                              {deleteError && <div className="agent-history-confirm-error" role="alert">{deleteError}</div>}
                              <div className="agent-history-confirm-actions">
                                <Button onPress={close}>Cancel</Button>
                                <Button
                                  className="danger"
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
