import { execFileSync } from 'node:child_process';
import { GITHUB_REPO_URL } from './buildInfoUrls.ts';

import type { BuildInfo } from '../types/buildInfo.types.ts';

/** Run a git subcommand; return trimmed stdout or null on failure. */
function runGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the current checkout identity from git.
 * Used at Vite build time (frontend inject) and Node process start (`/api/version`).
 * Node-only — do not import this module from browser UI code.
 */
export function resolveBuildInfo(): BuildInfo {
  const commit = runGit(['rev-parse', 'HEAD']);
  const commitShort =
    runGit(['rev-parse', '--short', 'HEAD']) ??
    (commit ? commit.slice(0, 7) : 'unknown');
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  // Non-empty porcelain output means uncommitted local changes.
  const dirty = Boolean(runGit(['status', '--porcelain']));

  return {
    commit: commit ?? 'unknown',
    commitShort,
    branch: branch ?? 'unknown',
    dirty,
    builtAt: new Date().toISOString(),
    repoUrl: GITHUB_REPO_URL,
  };
}
