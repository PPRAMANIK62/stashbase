import { useEffect } from 'react';
import { ModalShell } from '@/common/components/ModalShell';
import { api, type OnboardingPreferences, type UnsupportedFileSummary } from '@/common/api/api';
import { useAppActions, useWorkspace } from '@/store/AppContext';
import { Button } from '@/common/components/ui/button';

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

const REMAIN_ON_DISK_COPY =
  'These files remain unchanged on disk, but they will not appear in the Files view or StashBase search.';

export function UnsupportedFilesModal({ unsupportedFiles, onClose }: {
  unsupportedFiles: UnsupportedFileSummary;
  onClose: () => void;
}) {
  const { sourceCode, other, otherExtensions = [] } = unsupportedFiles;

  // Decide copy based on counts
  const showSource = sourceCode > 0;
  const showOther = other > 0;

  const footer = (
    <div className="mt-3.5 flex justify-end gap-2">
      <Button type="button" autoFocus onClick={onClose}>Continue with supported files</Button>
    </div>
  );

  if (showSource && showOther) {
    // Combined Modal
    const extList = formatExtensions(otherExtensions);
    return (
      <ModalShell title="Some files in this folder aren't supported" onCancel={onClose} top>
        {/* No description slot here (a list can't nest in its <p>), so the
          * list takes the description's top offset itself. */}
        <ul className="m-0 mt-2 list-disc space-y-2 pl-5 text-base leading-normal text-muted-foreground">
          <li>
            <strong>{sourceCode} source-code and project files</strong> are not shown or indexed.
          </li>
          <li>
            <strong>{other} files in other unsupported formats</strong> are not shown or indexed: {extList}.
          </li>
        </ul>
        <p className="mt-3.5 mb-0 text-base leading-normal text-muted-foreground">{REMAIN_ON_DISK_COPY}</p>
        {footer}
      </ModalShell>
    );
  }

  if (showSource) {
    // Source code only
    return (
      <ModalShell
        title="Source code files aren't supported"
        description={<>StashBase found <strong>{sourceCode} source-code and project files</strong> in this folder.</>}
        onCancel={onClose}
        top
      >
        <p className="m-0 text-base leading-normal text-muted-foreground">
          StashBase currently shows and indexes supported documents and media, not source code. {REMAIN_ON_DISK_COPY}
        </p>
        {footer}
      </ModalShell>
    );
  }

  if (showOther) {
    // Other formats only
    const extList = formatExtensions(otherExtensions);
    return (
      <ModalShell
        title="Some file formats aren't supported yet"
        description={<>StashBase found <strong>{other} files in unsupported formats</strong>: {extList}.</>}
        onCancel={onClose}
        top
      >
        <p className="m-0 text-base leading-normal text-muted-foreground">{REMAIN_ON_DISK_COPY}</p>
        {footer}
      </ModalShell>
    );
  }

  return null;
}

export default function UnsupportedFilesModalGate() {
  const state = useWorkspace();
  const { dispatch } = useAppActions();
  const { sourceCode = 0, other = 0 } = state.unsupportedFiles || {};
  const total = sourceCode + other;

  useEffect(() => {
    if (total === 0) return;
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
  }, [dispatch, state.folderPath, state.folder, total, sourceCode, other]);

  if (!state.unsupportedModalOpen || total === 0) return null;

  async function onClose() {
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
      onClose={onClose}
    />
  );
}
