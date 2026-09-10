import { parseGitHubRepositoryUrl } from '@shared/github-import';

export function extractGitHubRepoName(rawUrl: string): string {
  const result = parseGitHubRepositoryUrl(rawUrl);
  return result.ok ? result.parsed.defaultFolderName : '';
}

export function isValidGitHubRepoUrl(rawUrl: string): boolean {
  return parseGitHubRepositoryUrl(rawUrl).ok;
}
