import { useCallback, useEffect, useState } from "react";

type ElementSize = {
  width: number;
  height: number;
};

export const useElementSize = <T extends HTMLElement>() => {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  const ref = useCallback((element: T | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node) {
      setSize({ width: 0, height: 0 });
      return;
    }

    let rafId = 0;
    const updateSize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { width, height } = node.getBoundingClientRect();
        const nextWidth = Math.max(0, Math.round(width));
        const nextHeight = Math.max(0, Math.round(height));
        setSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight },
        );
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [node]);

  return { ref, size };
};
