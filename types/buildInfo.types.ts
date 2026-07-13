/** Git / deploy identity exposed in the UI footer and `/api/version`. */
export interface BuildInfo {
  /** Full 40-char commit SHA, or `"unknown"` if git is unavailable. */
  commit: string;
  /** Short SHA for display (usually 7 chars). */
  commitShort: string;
  /** Current branch name, or `"unknown"`. */
  branch: string;
  /** True when the working tree had uncommitted changes at resolve time. */
  dirty: boolean;
  /** ISO timestamp when this build info was resolved (build or process start). */
  builtAt: string;
  /** Public GitHub repo URL (no `.git` suffix). */
  repoUrl: string;
}
