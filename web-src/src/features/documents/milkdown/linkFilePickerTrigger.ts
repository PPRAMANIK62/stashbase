/** How the Markdown editor's "Link to file…" slash-menu item asks the
 * picker overlay to open, and the payload it carries. Same pubsub idiom as
 * `openLibrarySearch`/`openSettings`: an eager listener mounted once at the
 * app shell owns rendering and picks the target file; the caller (the
 * slash-menu item's `onRun`) only dispatches and supplies the callbacks
 * that turn a choice (or a dismissal) back into an editor transaction. */

export interface LinkFilePickerRequest {
  /** Called with the chosen file's workspace-relative path. */
  onSelect: (targetPath: string) => void;
  /** Called on Escape or a backdrop dismissal — no file was chosen. */
  onCancel: () => void;
}

export const OPEN_LINK_FILE_PICKER_EVENT = 'stashbase-open-link-file-picker';

export function openLinkFilePicker(request: LinkFilePickerRequest): void {
  window.dispatchEvent(new CustomEvent<LinkFilePickerRequest>(OPEN_LINK_FILE_PICKER_EVENT, { detail: request }));
}
