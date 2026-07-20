const MODEL_VIEWER_URL =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
const COIN_MODEL_URL = "/prana-coin.glb";

let hasPreloadedHeroAssets = false;

/**
 * Homepage-only: inject model-viewer + GLB preloads so `/stake/` does not
 * download the ~2.6 MB coin model from shared index.html.
 */
export function preloadHeroAssets() {
  if (hasPreloadedHeroAssets || typeof document === "undefined") return;
  hasPreloadedHeroAssets = true;

  const modulePreload = document.createElement("link");
  modulePreload.rel = "modulepreload";
  modulePreload.href = MODEL_VIEWER_URL;
  modulePreload.crossOrigin = "";
  document.head.appendChild(modulePreload);

  const glbPreload = document.createElement("link");
  glbPreload.rel = "preload";
  glbPreload.href = COIN_MODEL_URL;
  glbPreload.as = "fetch";
  glbPreload.type = "model/gltf-binary";
  glbPreload.crossOrigin = "";
  glbPreload.setAttribute("fetchpriority", "high");
  document.head.appendChild(glbPreload);
}
