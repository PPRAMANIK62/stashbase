/** Every renderer transport fails the same four ways: the server answered
 *  something the schema rejects, the window's folder grant is gone, the window
 *  is no longer allowed, or StashBase could not be reached. */
export type TransportFailureKind =
  | 'invalid-response'
  | 'scope-lost'
  | 'unauthorized'
  | 'unavailable';

/** A feature's failure ladder: the shared transport kinds plus whatever
 *  outcomes only that feature can meet. */
export type FeatureFailureKind<Extra extends string = never> = TransportFailureKind | Extra;

/** The one failure body features share. `name` identifies the failing
 *  capability for `instanceof` and for reports; `kind` selects the recovery a
 *  hook or view offers. */
export class FeatureError<Extra extends string = never> extends Error {
  readonly kind: FeatureFailureKind<Extra>;

  constructor(
    name: string,
    kind: FeatureFailureKind<Extra>,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = name;
    this.kind = kind;
  }
}

/** Construction surface a shared transport can use without knowing which
 *  feature it is failing for. */
export interface FeatureErrorClass<Extra extends string = never> {
  new (
    kind: FeatureFailureKind<Extra>,
    message: string,
    options?: ErrorOptions,
  ): FeatureError<Extra>;
}

/** Names one feature's failure ladder. The name is baked in here rather than
 *  read from the class so a minified build still reports it. */
export function featureErrorClass<Extra extends string = never>(
  name: string,
): FeatureErrorClass<Extra> {
  return class extends FeatureError<Extra> {
    constructor(kind: FeatureFailureKind<Extra>, message: string, options?: ErrorOptions) {
      super(name, kind, message, options);
    }
  };
}

/** Recognizes any feature failure, optionally one specific ladder by name.
 *  Callers that already hold the owning class should prefer `instanceof`. */
export function isFeatureError<Extra extends string = never>(
  error: unknown,
  name?: string,
): error is FeatureError<Extra> {
  return error instanceof FeatureError && (name === undefined || error.name === name);
}

/** `input` is the reader's own request coming back and is theirs to fix;
 *  `capability` is StashBase not being able to answer at all. */
type FailureTone = 'input' | 'capability';

/** What a surface shows for one refusal: the sentence, and whether it asks the
 *  reader to change something or tells them a capability is gone. */
export interface FailureView {
  readonly message: string;
  readonly tone: FailureTone;
}

export interface ReadFailureOptions<Extra extends string = never> {
  /** Read only failures this capability raised. A rejection from anywhere else
   *  is an unreachable capability rather than a guess at someone else's ladder. */
  readonly owner?: string;
  /** Kinds that report the reader's own request rather than a lost capability.
   *  Every kind not named here reads as `capability`. */
  readonly inputKinds?: readonly FeatureFailureKind<Extra>[];
  /** Kinds whose sentence the server authors because it names the exact
   *  missing piece no fixed line here could. That sentence travels as the
   *  failure's cause; without one, the mapped line stands. */
  readonly serverSentenceFor?: readonly FeatureFailureKind<Extra>[];
}

/** The sentence a refusal attached as its cause, or null when it carried no
 *  body worth reading. */
function authoredSentence(failure: FeatureError<string>): string | null {
  const cause: unknown = failure.cause;
  if (!(cause instanceof Error)) return null;
  const sentence = cause.message.trim();
  return sentence === '' ? null : sentence;
}

/**
 * Reads one thrown value as the sentence and tone a surface presents.
 *
 * The kind selects the line, so a transport's own diagnostic never reaches a
 * reader, and `messages` is a record over the whole ladder, so adding a kind
 * fails the build here rather than shipping a blank. Anything that is not a
 * failure on the named ladder reads as an unreachable capability.
 */
export function readFailure<Extra extends string = never>(
  error: unknown,
  messages: Readonly<Record<FeatureFailureKind<Extra>, string>>,
  options: ReadFailureOptions<Extra> = {},
): FailureView {
  const failure = isFeatureError<Extra>(error, options.owner) ? error : null;
  const kind: FeatureFailureKind<Extra> = failure ? failure.kind : 'unavailable';
  const authored =
    failure && options.serverSentenceFor?.includes(kind) ? authoredSentence(failure) : null;
  return {
    message: authored ?? messages[kind],
    tone: options.inputKinds?.includes(kind) ? 'input' : 'capability',
  };
}
