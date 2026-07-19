import { useEffect, useState } from "react";

/** Track the browser pathname so the SPA can switch views without a router library. */
export function useAppPathname(): string {
  const [pathname, setPathname] = useState(
    () => (typeof window === "undefined" ? "/" : window.location.pathname),
  );

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return pathname;
}
