/** Window-scoped receipts let a disconnected renderer recover an import's
 * actual result. Unknown receipts never authorize starting that copy again. */
export function createProjectImportOperations<T>(maxCompleted = 128) {
  const entries = new Map<string, {
    input: string;
    controller: AbortController;
    result: Promise<T>;
    completed: boolean;
  }>();
  const key = (windowId: string, id: string) => JSON.stringify([windowId, id]);
  return {
    start(windowId: string, id: string, input: string, run: (signal: AbortSignal) => Promise<T>) {
      const receipt = key(windowId, id);
      const previous = entries.get(receipt);
      if (previous) {
        if (previous.input && previous.input !== input) throw new Error('An import receipt cannot change its request.');
        return previous.result;
      }
      const controller = new AbortController();
      const result = Promise.resolve().then(() => run(controller.signal));
      const entry = { input, controller, result, completed: false };
      entries.set(receipt, entry);
      const complete = () => {
        entry.completed = true;
        const completed = [...entries].filter(([, value]) => value.completed);
        for (const [old] of completed.slice(0, Math.max(0, completed.length - maxCompleted))) entries.delete(old);
      };
      void result.then(complete, complete);
      return result;
    },
    result(windowId: string, id: string) { return entries.get(key(windowId, id))?.result ?? null; },
    cancel(windowId: string, id: string, cancelled: T) {
      const receipt = key(windowId, id);
      const entry = entries.get(receipt);
      if (entry) entry.controller.abort();
      else {
        // Cancel can overtake POST. Record it so a late POST cannot start work.
        this.start(windowId, id, '', async () => cancelled);
      }
    },
  };
}
