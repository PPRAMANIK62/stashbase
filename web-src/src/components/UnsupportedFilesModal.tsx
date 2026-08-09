import { useEffect } from 'react';
import { ModalShell } from './ModalShell';
import { api, type OnboardingPreferences, type UnsupportedFileSummary } from '../api';
import { useApp } from '../store/AppContext';

interface UnsupportedFilesModalProps {
  unsupportedFiles: UnsupportedFileSummary;
  onClose: () => void;
}

function formatExtensions(otherExtensions: Array<{ extension: string; count: number }>): string {
  const list = otherExtensions.map((e) => e.extension);
  const top3 = list.slice(0, 3);
  const remaining = list.length - 3;
  let base = top3.join(', ');
  if (remaining > 0) {
    base += ` and ${remaining} more format${remaining === 1 ? '' : 's'}`;
  }
  return base;
}

export function UnsupportedFilesModal({ unsupportedFiles, onClose }: UnsupportedFilesModalProps) {
  const { sourceCode, other, otherExtensions = [] } = unsupportedFiles;

  // Decide copy based on counts
  const showSource = sourceCode > 0;
  const showOther = other > 0;

  if (showSource && showOther) {
    // Combined Modal
    const extList = formatExtensions(otherExtensions);
    return (
      <ModalShell title="Some files in this folder aren't supported" onCancel={onClose} top>
        <div className="unsupported-files-modal-content space-y-4">
          <ul className="list-disc pl-5 space-y-2 text-sm text-imglytext/80 dark:text-dark-imglytext/80">
            <li>
              <strong>{sourceCode} source-code and project files</strong> are not shown or indexed.
            </li>
            <li>
              <strong>{other} files in other unsupported formats</strong> are not shown or indexed: {extList}.
            </li>
          </ul>
          <p className="text-sm text-imglytext/60 dark:text-dark-imglytext/60">
            These files remain unchanged on disk, but they will not appear in the Files view or StashBase search.
          </p>
        </div>
        <div className="modal-actions flex justify-end mt-6">
          <button type="button" className="modal-btn primary" onClick={onClose}>
            Continue with supported files
          </button>
        </div>
      </ModalShell>
    );
  }

  if (showSource) {
    // Source code only
    return (
      <ModalShell title="Source code files aren't supported" onCancel={onClose} top>
        <div className="unsupported-files-modal-content space-y-3">
          <p className="text-sm text-imglytext/80 dark:text-dark-imglytext/80">
            StashBase found <strong>{sourceCode} source-code and project files</strong> in this folder.
          </p>
          <p className="text-sm text-imglytext/60 dark:text-dark-imglytext/60">
            StashBase currently shows and indexes supported documents and media, not source code. These files remain unchanged on disk, but they will not appear in the Files view or StashBase search.
          </p>
        </div>
        <div className="modal-actions flex justify-end mt-6">
          <button type="button" className="modal-btn primary" onClick={onClose}>
            Continue with supported files
          </button>
        </div>
      </ModalShell>
    );
  }

  if (showOther) {
    // Other formats only
    const extList = formatExtensions(otherExtensions);
    return (
      <ModalShell title="Some file formats aren't supported yet" onCancel={onClose} top>
        <div className="unsupported-files-modal-content space-y-3">
          <p className="text-sm text-imglytext/80 dark:text-dark-imglytext/80">
            StashBase found <strong>{other} files in unsupported formats</strong>: {extList}.
          </p>
          <p className="text-sm text-imglytext/60 dark:text-dark-imglytext/60">
            These files remain unchanged on disk, but they will not appear in the Files view or StashBase search.
          </p>
        </div>
        <div className="modal-actions flex justify-end mt-6">
          <button type="button" className="modal-btn primary" onClick={onClose}>
            Continue with supported files
          </button>
        </div>
      </ModalShell>
    );
  }

  return null;
}

export function UnsupportedFilesModalGate() {
  const { state, dispatch } = useApp();
  const { sourceCode = 0, other = 0 } = state.unsupportedFiles || {};
  const total = sourceCode + other;

  useEffect(() => {
    if (total === 0 || state.welcomeVisible) return;
    let mounted = true;
    api.getOnboarding().then((prefs) => {
      if (!mounted) return;
      const needsSourceNotice = sourceCode > 0 && (prefs.sourceCodeNoticeVersion ?? 0) < 1;
      const needsOtherNotice = other > 0 && (prefs.unsupportedFormatsNoticeVersion ?? 0) < 1;
      if (needsSourceNotice || needsOtherNotice) {
        dispatch({ type: 'UNSUPPORTED_MODAL', open: true });
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [dispatch, state.welcomeVisible, state.folderPath, state.folder, total, sourceCode, other]);

  if (!state.unsupportedModalOpen || total === 0 || state.welcomeVisible) return null;

  async function handleClose() {
    dispatch({ type: 'UNSUPPORTED_MODAL', open: false });
    const patch: Partial<OnboardingPreferences> = {};
    if (sourceCode > 0) patch.sourceCodeNoticeVersion = 1;
    if (other > 0) patch.unsupportedFormatsNoticeVersion = 1;
    if (Object.keys(patch).length > 0) {
      try {
        await api.putOnboarding(patch);
      } catch (err) {
        console.warn('Failed to update onboarding preferences', err);
      }
    }
  }

  return (
    <UnsupportedFilesModal
      unsupportedFiles={state.unsupportedFiles!}
      onClose={handleClose}
    />
  );
}
