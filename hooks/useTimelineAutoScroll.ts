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

    const frame = requestAnimationFrame(() => {
      container.scrollTo({
        left: container.scrollWidth,
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [containerRef, events.length]);
};
