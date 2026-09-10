export type GenericFilePreview =
  | {
      content: string;
      kind: 'text';
      name: string;
      size: number;
      version?: string;
    }
  | {
      kind: 'binary' | 'cloud-placeholder' | 'special' | 'symlink' | 'too-large' | 'unreadable';
      message?: string;
      name: string;
      size?: number;
    };
