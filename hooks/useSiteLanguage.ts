import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SiteLocale } from "../types/locale.types";
import { SITE_LOCALE_STORAGE_KEY } from "../types/locale.types";

type SiteLanguageContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
};

const SiteLanguageContext = createContext<SiteLanguageContextValue | null>(null);

function readInitialLocale(): SiteLocale {
  if (typeof window === "undefined") return "vi";
  return window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY) === "en" ? "en" : "vi";
}

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>(readInitialLocale);

  const setLocale = useCallback((next: SiteLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  );

  return createElement(
    SiteLanguageContext.Provider,
    { value },
    children,
  );
}

export function useSiteLanguage(): SiteLanguageContextValue {
  const ctx = useContext(SiteLanguageContext);
  if (!ctx) {
    throw new Error("useSiteLanguage must be used within SiteLanguageProvider");
  }
  return ctx;
}
