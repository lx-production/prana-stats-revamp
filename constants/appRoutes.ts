/** Client path for the Terms / Risk Disclosure page (linkable from announcements). */
export const TERMS_RISK_PATH = "/terms";

export function isTermsRiskPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === TERMS_RISK_PATH;
}
