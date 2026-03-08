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

    container.scrollLeft = container.scrollWidth;
  }, [containerRef, events.length]);
};
