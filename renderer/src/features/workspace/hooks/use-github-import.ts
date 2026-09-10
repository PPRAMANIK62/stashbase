import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { filesFailure } from '@/features/workspace/application/failure-messages';
import type { GitHubImportPort } from '@/features/workspace/application/ports';
import type { FailureView } from '@/shared/domain/feature-error';

export interface GitHubImportView {
  /** What the destination folder would be called, derived from the URL until
   *  the reader types their own. */
  readonly folderName: string;
  /** Why the destination name is unusable, or null. Kept apart from the URL's
   *  issue so each is said under the field it is about. */
  readonly nameIssue: string | null;
  /** Why the URL is unusable, or null. Silent while the field is empty: a
   *  reader who has typed nothing has made no mistake. */
  readonly urlIssue: string | null;
  /** A refusal from the server, which is a different thing from an input the
   *  reader can see is wrong. */
  readonly failure: FailureView | null;
  readonly canSubmit: boolean;
  readonly pending: boolean;
  readonly url: string;
  cancel(): void;
  setFolderName(next: string): void;
  setUrl(next: string): void;
  submit(): void;
}

export interface GitHubImportOptions {
  /** Handed the published folder path. Opening it belongs to the folder lane
   *  that already owns save barriers and abandonment, not to this hook. */
  onImported(path: string): void;
}

/**
 * One public GitHub repository, acquired as a library folder.
 *
 * The URL and folder-name rules are the same modules the server validates
 * with, so a reader is refused inline by the rule that would refuse them
 * anyway rather than by a second approximation of it. The server still parses
 * both again: this is feedback, not authority.
 *
 * The folder name follows the URL until the reader edits it, and stops
 * following once they have. Typing a name and then fixing a typo in the URL
 * must not silently discard the name.
 */
export function useGitHubImport(
  port: GitHubImportPort,
  { onImported }: GitHubImportOptions,
): GitHubImportView {
  const [url, setUrlState] = useState('');
  const [typedName, setTypedName] = useState<string | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const parsed = useMemo(() => port.readUrl(url), [port, url]);
  const derivedName = parsed.ok ? parsed.folderName : '';
  const folderName = typedName ?? derivedName;

  const run = useMutation({
    mutationFn: ({ signal }: { signal: AbortSignal }) => port.run(url, folderName, signal),
    onSettled: () => setController(null),
    onSuccess: (path: string) => onImported(path),
  });

  const nameIssue = folderName ? port.folderNameIssue(folderName) : null;
  const urlIssue = url.trim() && !parsed.ok ? parsed.message : null;

  const { isPending, mutate, reset } = run;
  const submit = useCallback(() => {
    if (isPending || !parsed.ok || !folderName || port.folderNameIssue(folderName)) return;
    const next = new AbortController();
    setController(next);
    mutate({ signal: next.signal });
  }, [folderName, isPending, mutate, parsed.ok, port]);

  const cancel = useCallback(() => {
    controller?.abort();
    reset();
  }, [controller, reset]);

  const setUrl = useCallback((next: string) => {
    setUrlState(next);
    reset();
  }, [reset]);

  const setFolderName = useCallback((next: string) => setTypedName(next), []);

  return {
    canSubmit: parsed.ok && folderName !== '' && nameIssue === null && !isPending,
    cancel,
    failure: run.error ? filesFailure(run.error) : null,
    folderName,
    nameIssue,
    pending: isPending,
    setFolderName,
    setUrl,
    submit,
    url,
    urlIssue,
  };
}
