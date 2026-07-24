/** Client path for the Terms / Risk Disclosure page (linkable from announcements). */
export const TERMS_RISK_PATH = "/terms";

/** Client path for the Privacy Policy page. */
export const PRIVACY_PATH = "/privacy";

/** Staking path without trailing slash (redirects to canonical). */
export const STAKE_PATH = "/stake";

/** Canonical staking URL (trailing slash). Use this for links and redirects. */
export const STAKE_CANONICAL_PATH = "/stake/";

/** Swap guide path without trailing slash (redirects to canonical). */
export const GUIDE_SWAP_PATH = "/guide/swap";

/** Canonical Swap guide URL (trailing slash). */
export const GUIDE_SWAP_CANONICAL_PATH = "/guide/swap/";

/** Staking guide path without trailing slash (redirects to canonical). */
export const GUIDE_STAKING_PATH = "/guide/staking";

/** Canonical Staking guide URL (trailing slash). */
export const GUIDE_STAKING_CANONICAL_PATH = "/guide/staking/";

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

/** True for `/guide/swap` and any path under `/guide/swap/`. */
export function isGuideSwapPath(pathname: string): boolean {
  return pathname === GUIDE_SWAP_PATH || pathname.startsWith(GUIDE_SWAP_CANONICAL_PATH);
}

/** True for `/guide/staking` and any path under `/guide/staking/`. */
export function isGuideStakingPath(pathname: string): boolean {
  return (
    pathname === GUIDE_STAKING_PATH ||
    pathname.startsWith(GUIDE_STAKING_CANONICAL_PATH)
  );
}
