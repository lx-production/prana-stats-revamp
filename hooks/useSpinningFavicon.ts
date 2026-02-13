import { useEffect } from "react";
import { startSpinningFavicon, type SpinningFaviconOptions } from "../spinningFavicon.ts";

export function useSpinningFavicon(options?: SpinningFaviconOptions) {
  useEffect(() => {
    const stop = startSpinningFavicon(options);
    return () => stop?.();
  }, [
    options?.iconUrl,
    options?.size,
    options?.imageScale,
    options?.stepDegrees,
    options?.fps,
  ]);
}
