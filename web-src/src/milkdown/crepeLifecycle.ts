import { EditorStatus } from '@milkdown/kit/core';

interface StatusAwareCrepe {
  editor: { status: EditorStatus };
  destroy: () => Promise<unknown>;
}

export function destroyCrepeIfCreated(editor: StatusAwareCrepe): boolean {
  if (editor.editor.status !== EditorStatus.Created) return false;
  void editor.destroy();
  return true;
}
