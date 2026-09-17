export interface LocalComponentStatus {
  readonly status: 'not-installed' | 'downloading' | 'installed' | 'failed';
  readonly error:
    | 'network'
    | 'verification'
    | 'installation'
    | 'manifest'
    | 'interrupted'
    | 'unsupported-system'
    | null;
}
