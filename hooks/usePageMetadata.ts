import { useEffect } from "react";

/**
 * Set document title + meta description for the current page.
 * Restores the previous values on unmount (shared HTML shell).
 */
export function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionMeta?.getAttribute("content") ?? null;

    document.title = title;
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", description);
    }

    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription !== null) {
        descriptionMeta.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
