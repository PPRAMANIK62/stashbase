import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ModalShell } from '@/common/components/ModalShell';
import { Button } from '@/common/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/common/components/ui/field';
import { Input } from '@/common/components/ui/input';
import { errorMessage } from '@/common/api/apiTransport';
import { useAppActions } from '@/store/contexts/AppContext';
import { useWorkspace } from '@/store/contexts/WorkspaceContext';
import { shortenFolderPath } from '@/common/lib/paths';
import { useGitHubImportRequest } from '@/features/workspace/hooks/useGitHubImportRequest';
import type { ManagedImportGitHubModalProps } from './ImportGitHubModal';
import {
  extractGitHubRepoName,
  isValidGitHubRepoUrl,
} from '@/features/workspace/lib/githubImportValidation';
import { validateFolderName } from '@shared/folder-name';

export default function ManagedImportGitHubModal({ onClose }: ManagedImportGitHubModalProps) {
  const { actions } = useAppActions();
  const workspace = useWorkspace();
  const { cancelImport, getFolderHome, importRepository } = useGitHubImportRequest();
  const [url, setUrl] = useState('');
  const [folderName, setFolderName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [folderHome, setFolderHome] = useState('');
  const [folderHomeError, setFolderHomeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [publishedPath, setPublishedPath] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    void getFolderHome().then((res) => {
      if (active && res.path) setFolderHome(res.path);
    }).catch((err: unknown) => {
      if (active) setFolderHomeError(`Could not determine the folder home: ${errorMessage(err)}`);
    });
    return () => { active = false; };
  }, [getFolderHome]);

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
    cancelImport();
    onClose();
  };

  const trimmedUrl = url.trim();
  const trimmedName = folderName.trim();
  const isUrlValid = isValidGitHubRepoUrl(trimmedUrl);
  const folderNameError = validateFolderName(trimmedName);
  const canSubmit = !importing && (publishedPath
    ? true
    : Boolean(folderHome) && isUrlValid && folderNameError == null);

  const destinationPath = publishedPath ?? (folderHome
    ? (trimmedName ? `${folderHome.replace(/[/\\]+$/, '')}/${trimmedName}` : folderHome)
    : (trimmedName || '…'));
  const destinationDisplay = folderHome
    ? shortenFolderPath(destinationPath, workspace.homeDir)
    : destinationPath;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setImporting(true);
    if (publishedPath) {
      try {
        await actions.openFolder(publishedPath);
        onClose();
      } catch (err: unknown) {
        setError(`The repository remains at ${publishedPath}. StashBase could not open it: ${errorMessage(err)}`);
        setImporting(false);
      }
      return;
    }

    let importedPath: string | null = null;
    let requestAborted = false;

    try {
      const result = await importRepository({ url: trimmedUrl, folderName: trimmedName });
      importedPath = result.path;
      setPublishedPath(result.path);
      await actions.openFolder(result.path);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        requestAborted = true;
        return;
      }
      setError(importedPath
        ? `The repository remains at ${importedPath}. StashBase could not open it: ${errorMessage(err)}`
        : errorMessage(err));
    } finally {
      if (!requestAborted) setImporting(false);
    }
  };

  return (
    <ModalShell
      title="Import from GitHub"
      description="Clone a public repository into your StashBase folder home."
      onCancel={handleCancel}
      initialFocus={urlInputRef}
    >
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        className="flex flex-col gap-4"
        aria-busy={importing}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="github-import-url">Repository URL</FieldLabel>
            <Input
              id="github-import-url"
              ref={urlInputRef}
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={handleUrlChange}
              disabled={importing || publishedPath != null}
              required
              aria-invalid={trimmedUrl.length > 0 && !isUrlValid}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="github-import-folder-name">Folder name</FieldLabel>
            <Input
              id="github-import-folder-name"
              placeholder="folder-name"
              value={folderName}
              onChange={handleFolderNameChange}
              disabled={importing || publishedPath != null}
              required
              aria-invalid={trimmedName.length > 0 && folderNameError != null}
              aria-describedby={trimmedName.length > 0 && folderNameError ? 'github-import-folder-error' : undefined}
            />
            {trimmedName.length > 0 && folderNameError && (
              <FieldError id="github-import-folder-error">{folderNameError}</FieldError>
            )}
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

          {folderHomeError && <FieldError>{folderHomeError}</FieldError>}
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
            {importing ? 'Importing…' : publishedPath ? 'Open Imported Folder' : 'Import and Open'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
