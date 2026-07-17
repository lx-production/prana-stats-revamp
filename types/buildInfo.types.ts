/** Git / deploy identity exposed in the UI footer and `/api/version`. */
export interface BuildInfo {
  commit: string; // Full 40-char commit SHA, or `"unknown"` if git is unavailable.
  commitShort: string; // Short SHA for display (usually 7 chars).
  /**
   * Annotated/lightweight tag exactly matching HEAD (e.g. `"v2.0.0"`),
   * or `null` when HEAD is not a tagged release commit.
   */
  tag: string | null;
  branch: string; // Current branch name, or `"unknown"`.
  dirty: boolean; // True when the working tree had uncommitted changes at resolve time.
  builtAt: string; // ISO timestamp when this build info was resolved (build or process start).
  repoUrl: string; // Public GitHub repo URL (no `.git` suffix).
}
