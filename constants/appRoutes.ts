/** Client path for the Terms / Risk Disclosure page (linkable from announcements). */
export const TERMS_RISK_PATH = "/terms";

/** Client path for the Privacy Policy page. */
export const PRIVACY_PATH = "/privacy";

/** Staking path without trailing slash (redirects to canonical). */
export const STAKE_PATH = "/stake";

/** Canonical staking URL (trailing slash). Use this for links and redirects. */
export const STAKE_CANONICAL_PATH = "/stake/";

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isTermsRiskPath(pathname: string): boolean {
  return normalizePathname(pathname) === TERMS_RISK_PATH;
}

export function isPrivacyPath(pathname: string): boolean {
  return normalizePathname(pathname) === PRIVACY_PATH;
}

/** True for `/stake` and any path under `/stake/` (lazy staking page). */
export function isStakePath(pathname: string): boolean {
  return pathname === STAKE_PATH || pathname.startsWith(STAKE_CANONICAL_PATH);
}
