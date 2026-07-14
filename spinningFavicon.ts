// This module starts a spinning favicon animation by updating the favicon via a canvas.
// It returns a cleanup function you can call to stop the animation.

import { PRANA_ICON_DATA_URL } from "./utils/pranaIconDataUrl.ts";

export interface SpinningFaviconOptions {
  iconUrl?: string;
  size?: number;
  imageScale?: number;
  stepDegrees?: number;
  fps?: number;
}

export function startSpinningFavicon(options: SpinningFaviconOptions = {}): () => void {
  const {
    // Data URL avoids a second network fetch of /assets/icons/prana.svg (favicon already loads the file).
    iconUrl = PRANA_ICON_DATA_URL,
    size = 96,
    imageScale = 0.8,
    stepDegrees = 5,
    fps = 30,
  } = options;

  // Respect user's OS accessibility setting.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Get (or create) the favicon link element.
  let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon'], link[rel*='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  // If reduced motion is preferred, just set a static favicon and exit.
  if (prefersReducedMotion) {
    favicon.href = iconUrl;
    return () => {};
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const img = new Image();
  // Same-origin / data-URL icon — no CORS needed (crossOrigin caused a duplicate network fetch).
  img.src = iconUrl;

  let rafId: number | null = null;
  let lastTs = 0;
  let angle = 0;
  let stopped = false;

  const frameIntervalMs = Math.max(1, Math.round(1000 / Math.max(1, fps)));

  const tick = (ts: number) => {
    if (stopped) return;

    // Don't animate while tab is hidden (saves CPU).
    if (document.hidden) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (!lastTs) lastTs = ts;
    const delta = ts - lastTs;

    if (delta >= frameIntervalMs) {
      lastTs = ts - (delta % frameIntervalMs);

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((angle * Math.PI) / 180);

      const imgSize = size * imageScale;
      ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      ctx.restore();

      angle = (angle + stepDegrees) % 360;
      favicon.href = canvas.toDataURL("image/png");
    }

    rafId = requestAnimationFrame(tick);
  };

  const start = async () => {
    try {
      // If supported, wait for the image to decode for smoother start.
      if (img.decode) await img.decode();
    } catch {
      // ignore decode errors; onload below will handle.
    }
    if (!stopped) rafId = requestAnimationFrame(tick);
  };

  img.onload = () => void start();
  img.onerror = () => {
    // If the icon can't be loaded, fall back to static.
    favicon.href = iconUrl;
  };

  return () => {
    stopped = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  };
}
