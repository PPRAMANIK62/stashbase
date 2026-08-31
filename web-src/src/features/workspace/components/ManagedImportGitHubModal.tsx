import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ModalShell } from '@/common/components/ModalShell';
import { Button } from '@/common/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/common/components/ui/field';
import { Input } from '@/common/components/ui/input';
import { api, errorMessage } from '@/common/api/api';
import { useAppActions } from '@/store/contexts/AppContext';
import { useWorkspace } from '@/store/contexts/WorkspaceContext';
import { shortenFolderPath } from '@/common/lib/paths';
import {
  extractGitHubRepoName,
  isValidGitHubRepoUrl,
  type ManagedImportGitHubModalProps,
} from './ImportGitHubModal';

export default function ManagedImportGitHubModal({ onClose }: ManagedImportGitHubModalProps) {
  const { actions } = useAppActions();
  const workspace = useWorkspace();
  const [url, setUrl] = useState('');
  const [folderName, setFolderName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [homeDir, setHomeDir] = useState<string>(workspace.homeDir ?? '');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!homeDir) {
      let active = true;
      void api.getFolderHome().then((res) => {
        if (active && res.path) setHomeDir(res.path);
      }).catch(() => {
        /* best-effort home dir fallback */
      });
      return () => { active = false; };
    }
  }, [homeDir]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setError(null);
    if (!isCustomName) {
      const derived = extractGitHubRepoName(newUrl);
      if (derived) {
        setFolderName(derived);
      }
    }
  };

  const handleFolderNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFolderName(e.target.value);
    setIsCustomName(true);
    setError(null);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onClose();
  };

  const trimmedUrl = url.trim();
  const trimmedName = folderName.trim();
  const isUrlValid = isValidGitHubRepoUrl(trimmedUrl);
  const isNameValid = trimmedName.length > 0;
  const canSubmit = isUrlValid && isNameValid && !importing;

  const destinationPath = homeDir
    ? (trimmedName ? `${homeDir.replace(/[/\\]+$/, '')}/${trimmedName}` : homeDir)
    : (trimmedName || '…');
  const destinationDisplay = homeDir
    ? shortenFolderPath(destinationPath, homeDir)
    : destinationPath;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setImporting(true);
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const result = await api.importPublicGitHubRepository(
        { url: trimmedUrl, folderName: trimmedName },
        { signal: ac.signal },
      );
      onClose();
      await actions.openFolder(result.path);
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        setImporting(false);
        return;
      }
      setError(errorMessage(err));
      setImporting(false);
    }
  };

  return (
    <ModalShell
      title="Import from GitHub"
      description="Clone a public repository into your StashBase folder home."
      onCancel={handleCancel}
    >
      <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="github-import-url">Repository URL</FieldLabel>
            <Input
              id="github-import-url"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={handleUrlChange}
              disabled={importing}
              autoFocus
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="github-import-folder-name">Folder name</FieldLabel>
            <Input
              id="github-import-folder-name"
              placeholder="folder-name"
              value={folderName}
              onChange={handleFolderNameChange}
              disabled={importing}
            />
          </Field>

          <Field>
            <FieldLabel>Destination</FieldLabel>
            <div
              className="w-fit max-w-full truncate rounded-xs bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
              title={destinationPath}
            >
              {destinationDisplay}
            </div>
          </Field>

          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
          >
            {importing ? 'Importing…' : 'Import and Open'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
