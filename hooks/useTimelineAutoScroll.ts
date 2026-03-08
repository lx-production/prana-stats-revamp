import { RefObject, useEffect } from "react";

export const useTimelineAutoScroll = (
  containerRef: RefObject<HTMLElement>,
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
