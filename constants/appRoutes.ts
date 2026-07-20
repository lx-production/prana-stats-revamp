/** Client path for the Terms / Risk Disclosure page (linkable from announcements). */
export const TERMS_RISK_PATH = "/terms";

/** Client path for the Privacy Policy page. */
export const PRIVACY_PATH = "/privacy";

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isTermsRiskPath(pathname: string): boolean {
  return normalizePathname(pathname) === TERMS_RISK_PATH;
}

export function isPrivacyPath(pathname: string): boolean {
  return normalizePathname(pathname) === PRIVACY_PATH;
}
