export const applicationFailureKinds = [
  'unauthorized',
  'unavailable',
  'invalid-response',
  'conflict',
  'cancelled',
  'fatal',
] as const;

export type ApplicationFailureKind = (typeof applicationFailureKinds)[number];

export interface ApplicationFailure {
  kind: ApplicationFailureKind;
  message: string;
  cause: unknown;
}
