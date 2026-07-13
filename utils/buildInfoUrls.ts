import type { BuildInfo } from '../types/buildInfo.types.ts';

export const GITHUB_REPO_URL = 'https://github.com/lx-production/prana-stats-revamp';

/** GitHub commit URL for a full or short SHA. */
export function commitUrl(repoUrl: string, commit: string): string | null {
  if (!commit || commit === 'unknown') return null;
  return `${repoUrl}/commit/${commit}`;
}

/** Display label: short SHA plus `*` when the tree was dirty at resolve time. */
export function formatBuildSha(info: Pick<BuildInfo, 'commitShort' | 'dirty'>): string {
  return `${info.commitShort}${info.dirty ? '*' : ''}`;
}
