export interface StatusAwareMarkdownEditor {
  destroy(): Promise<unknown>;
  editor: { status: string };
}

export interface CreatableMarkdownEditor extends StatusAwareMarkdownEditor {
  create(): Promise<unknown>;
}

export function destroyMarkdownEditorIfCreated(editor: StatusAwareMarkdownEditor): boolean {
  if (editor.editor.status !== 'Created') return false;
  void editor.destroy();
  return true;
}

/** Own one asynchronous creation attempt without destroying rejected OnCreate editors. */
export function startMarkdownEditorCreation<T extends CreatableMarkdownEditor>(
  editor: T,
  callbacks: { failed(error: unknown): void; ready(editor: T): void },
): () => void {
  let disposed = false;
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = destroyMarkdownEditorIfCreated(editor);
  };

  void editor
    .create()
    .then(() => {
      if (disposed) destroy();
      else callbacks.ready(editor);
    })
    .catch((error: unknown) => {
      if (!disposed) callbacks.failed(error);
    });

  return () => {
    disposed = true;
    destroy();
  };
}
