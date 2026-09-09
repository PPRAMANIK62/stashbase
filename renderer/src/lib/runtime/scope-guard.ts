/** The scope guard every runtime in the app shares: `capture` before the
 *  first await, `accept` afterwards. A completion is applied only while the
 *  runtime still holds the scope the work started under and no newer operation
 *  has retired it. The scope alone cannot tell a completion apart from one the
 *  same scope retired while it was in flight, which is why the generation
 *  travels beside it rather than inside it. */

/** What one operation was started under: the runtime's scope, and the
 *  generation of operations live at the time. Both have to still hold for a
 *  completion to be applied. */
export interface CapturedScope<Scope> {
  readonly generation: number;
  readonly scope: Scope;
}

export interface ScopeGuard<Scope> {
  /** Runs `completion` only when the operation `captured` was started under is
   *  still the live one: same scope, no newer retirement, and a runtime that
   *  has not been disposed. Answers whether it ran, so a caller can drop the
   *  rest of a stale completion too. */
  accept(captured: CapturedScope<Scope>, completion: () => void): boolean;
  /** The token an operation is started under. Take it before the operation's
   *  first `await` and hand it back to `accept` afterwards: capturing at
   *  completion time would compare the live scope with itself and guard
   *  nothing. */
  capture(): CapturedScope<Scope>;
  /** Retires every operation in flight, so their completions are refused. */
  retireOperations(): void;
}

export interface ScopeGuardOptions<Scope> {
  /** Whether the runtime has been torn down. A disposed runtime accepts
   *  nothing, however fresh the captured token looks. */
  disposed(): boolean;
  /** Whether a captured scope still names the work the live scope is about. */
  sameScope(captured: Scope, live: Scope): boolean;
  /** The scope as of now. Read on every capture and accept, so a runtime whose
   *  scope moves is guarded by the same token vocabulary as a fixed one. */
  scope(): Scope;
}

export function createScopeGuard<Scope>({
  disposed,
  sameScope,
  scope,
}: ScopeGuardOptions<Scope>): ScopeGuard<Scope> {
  let generation = 0;
  return {
    accept(captured, completion) {
      if (disposed() || captured.generation !== generation || !sameScope(captured.scope, scope())) {
        return false;
      }
      completion();
      return true;
    },
    capture() {
      return { generation, scope: scope() };
    },
    retireOperations() {
      generation += 1;
    },
  };
}
