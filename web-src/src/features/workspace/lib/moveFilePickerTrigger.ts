/**
 * Open request for the "Move to…" folder picker — the keyboard path to the
 * file move that drag-to-a-folder-row performs (`useTreeRowDrag`). Same
 * event convention as Quick Open and the editor's "Link to file…" picker:
 * the trigger is a window event so the caller (the file row's context
 * menu, which unmounts as soon as an item is chosen) never has to outlive
 * the picker it opened. The always-mounted gate in
 * `components/MoveFilePicker.tsx` owns the listener.
 */

export const OPEN_MOVE_FILE_PICKER_EVENT = 'stashbase-open-move-file-picker';

export interface MoveFilePickerRequest {
  /** Folder-relative path of the file to move. */
  path: string;
}

export function openMoveFilePicker(path: string): void {
  window.dispatchEvent(new CustomEvent<MoveFilePickerRequest>(
    OPEN_MOVE_FILE_PICKER_EVENT,
    { detail: { path } },
  ));
}
