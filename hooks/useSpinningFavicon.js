import { useEffect } from "react";
import { startSpinningFavicon } from "../spinningFavicon.js";

export function useSpinningFavicon(options) {
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

