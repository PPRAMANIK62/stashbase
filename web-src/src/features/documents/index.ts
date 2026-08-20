/**
 * Public surface of the Documents feature.
 *
 * `DocumentViewer` is the entry point: one component that owns the
 * file-format → viewer dispatch and every viewer's lazy boundary, so a
 * new format never reaches the composition root. The per-format viewers
 * are deliberately NOT exported — they are reachable only through the
 * dispatch, which is what keeps their chunks off the initial load.
 *
 * The others are shell-level seams: two always-mounted overlay gates (editor
 * history, and the Markdown editor's "Link to file…" slash-menu picker), the
 * preview-iframe message bridge the shell installs once, and the chord
 * predicate the shell's global keydown listener asks.
 */
export { DocumentViewer } from '@/features/documents/components/DocumentViewer';
export { EditorHistoryNavigator } from '@/features/documents/components/EditorHistoryNavigator';
export { LinkFilePicker } from '@/features/documents/components/LinkFilePicker';
export { usePreviewMessages } from '@/features/documents/hooks/usePreviewMessages';
export { isEditorHistoryChord } from '@/features/documents/lib/editorHistory';
