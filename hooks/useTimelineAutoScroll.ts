import { RefObject, useEffect } from "react";

export const useTimelineAutoScroll = <T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  events: unknown[]
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Jump instantly to the latest event. Smooth scroll across a long row
    // made the section feel empty for a couple of seconds on first paint.
    const frame = requestAnimationFrame(() => {
      container.scrollTo({
        left: container.scrollWidth,
        behavior: "auto",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [containerRef, events.length]);
};
