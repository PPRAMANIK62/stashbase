export interface ParsedGitHubRepositoryUrl {
  canonicalUrl: string;
  owner: string;
  repo: string;
  defaultFolderName: string;
}

export type GitHubRepositoryUrlValidation =
  | { ok: true; parsed: ParsedGitHubRepositoryUrl }
  | { ok: false; message: string };

const GITHUB_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GITHUB_REPOSITORY = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

/** Parse the one public acquisition URL shape supported by GitHub import. */
export function parseGitHubRepositoryUrl(rawUrl: unknown): GitHubRepositoryUrlValidation {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, message: 'GitHub repository URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      message: 'Invalid URL. Enter a complete https://github.com/<owner>/<repo> URL.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, message: 'Only HTTPS GitHub URLs are supported.' };
  }
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return { ok: false, message: 'Only github.com URLs are supported.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'URLs with credentials are not supported.' };
  }
  if (parsed.port) {
    return { ok: false, message: 'Custom ports are not supported.' };
  }
  if (parsed.search) {
    return { ok: false, message: 'Query parameters are not supported.' };
  }
  if (parsed.hash) {
    return { ok: false, message: 'URL fragments are not supported.' };
  }

  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(parsed.pathname);
  if (!match) {
    return {
      ok: false,
      message: 'Enter a complete https://github.com/<owner>/<repo> URL.',
    };
  }
  const owner = match[1];
  const rawRepository = match[2];
  const repo = rawRepository.endsWith('.git') ? rawRepository.slice(0, -4) : rawRepository;
  if (!GITHUB_OWNER.test(owner) || !GITHUB_REPOSITORY.test(repo)) {
    return {
      ok: false,
      message: 'Enter a complete https://github.com/<owner>/<repo> URL.',
    };
  }

  return {
    ok: true,
    parsed: {
      canonicalUrl: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
      defaultFolderName: repo,
    },
  };
}
