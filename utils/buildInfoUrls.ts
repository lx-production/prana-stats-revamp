import type { BuildInfo } from '../types/buildInfo.types.ts';

export const GITHUB_REPO_URL = 'https://github.com/lx-production/prana-stats-revamp';

/** GitHub commit URL for a full or short SHA. */
export function commitUrl(repoUrl: string, commit: string): string | null {
  if (!commit || commit === 'unknown') return null;
  return `${repoUrl}/commit/${commit}`;
}

/** GitHub release/tag page URL (e.g. `/releases/tag/v2.0.0`). */
export function releaseUrl(repoUrl: string, tag: string): string | null {
  if (!tag) return null;
  return `${repoUrl}/releases/tag/${encodeURIComponent(tag)}`;
}

/**
 * Prefer the release page when HEAD is tagged; otherwise the commit page.
 */
export function buildIdentityUrl(
  info: Pick<BuildInfo, 'repoUrl' | 'commit' | 'tag'>,
): string | null {
  if (info.tag) return releaseUrl(info.repoUrl, info.tag);
  return commitUrl(info.repoUrl, info.commit);
}

/**
 * Display label: git tag when present, else short SHA.
 * Trailing `*` means the tree was dirty at resolve time.
 */
export function formatBuildLabel(
  info: Pick<BuildInfo, 'tag' | 'commitShort' | 'dirty'>,
): string {
  const base = info.tag ?? info.commitShort;
  return `${base}${info.dirty ? '*' : ''}`;
}
