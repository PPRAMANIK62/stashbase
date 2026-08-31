import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { LazyManagedModal } from '@/common/components/LazyManaged';

export function extractGitHubRepoName(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'github.com') {
      const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
      if (parts.length === 2 && parts[1]) {
        const repo = parts[1].endsWith('.git') ? parts[1].slice(0, -4) : parts[1];
        if (repo && repo !== '.' && repo !== '..') return repo;
      }
    }
  } catch {
    /* ignore parse errors while typing */
  }
  return '';
}

export function isValidGitHubRepoUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') return false;
    if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443') || parsed.search || parsed.hash) {
      return false;
    }
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const repo = parts[1].endsWith('.git') ? parts[1].slice(0, -4) : parts[1];
    return Boolean(repo && repo !== '.' && repo !== '..');
  } catch {
    return false;
  }
}

export interface ImportGitHubModalProps {
  onClose: () => void;
}

export interface ManagedImportGitHubModalProps extends ImportGitHubModalProps {
  isTopmost: boolean;
}

const ManagedImportGitHubModal = lazyWithRetry(() => import('./ManagedImportGitHubModal'));

export function ImportGitHubModal({ onClose }: ImportGitHubModalProps) {
  return (
    <LazyManagedModal<ManagedImportGitHubModalProps>
      as={ManagedImportGitHubModal}
      open
      label="Opening GitHub import…"
      onCancel={onClose}
      closeOnBackdrop
      componentProps={{ onClose }}
    />
  );
}
