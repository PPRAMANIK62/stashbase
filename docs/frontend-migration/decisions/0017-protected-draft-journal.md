---
status: proposed
---

# Protect crash-recovery drafts with an Electron-provisioned journal key

Unsaved editable text is journaled by the server-side File Transactions
module as bounded, encrypted snapshots keyed by source identity and the
source version the draft was typed over. The journal lives in the server's
private local-data directory, never inside a library folder, so folder sync,
backups, and indexing never see it. Electron provisions one random journal
key per installation, wraps it at rest with `safeStorage`, and hands the
unwrapped key to the owned server over the process-private owner channel at
startup. Without OS-backed key protection the journal is disabled and the
absence stays a visible gap; nothing falls back to plaintext. The renderer
submits snapshots off the interaction path through one Documents port,
removes them after a confirmed save or an explicit discard, and lists the
survivors after the next launch so the person restores each one into an
unsaved draft or discards it. Restore never writes the source; the existing
save barrier and conflict flow decide what lands on disk. Logout does not
touch the journal because drafts belong to local files, not to the hosted
account. Entries are bounded per source and per journal and expire after a
retention window, so a forgotten journal cannot grow without limit. Two
windows editing one source share one entry and the newest snapshot wins,
which matches the single document authority each source already has.
This accepts an Electron-owned secret and a server-owned private store so
recovery can exist without widening any trust boundary or letting derived
state surface as durable content.
