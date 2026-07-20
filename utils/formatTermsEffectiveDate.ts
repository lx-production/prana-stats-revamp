/**
 * Format the terms effective date for display (date-only, UTC calendar day).
 */
export function formatTermsEffectiveDate(
  isoDate: string,
  locale: "en" | "vi",
): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  return date.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
