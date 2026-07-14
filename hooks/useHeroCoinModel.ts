import { useEffect, useRef, useState } from "react";
import { createOnKeyDown, createSpinCoin } from "../utils/modelViewerHelpers";

import type { CSSProperties } from "react";
import type { ModelViewerElement } from "../types/modelViewer.types";

export const COIN_MODEL_URL = "/prana-coin.glb";
export const CAMERA_ORBIT_BASE = { theta: 15, phi: 120, radius: "120%" };
export const CAMERA_ORBIT_ATTR = `${CAMERA_ORBIT_BASE.theta}deg ${CAMERA_ORBIT_BASE.phi}deg ${CAMERA_ORBIT_BASE.radius}`;
export const CAMERA_RADIUS_CLAMP = `auto auto ${CAMERA_ORBIT_BASE.radius}`;

const COIN_STYLE: CSSProperties = {
  width: "min(92vw, 880px)",
  height: "60vh",
};

// Load the <model-viewer> web component script once
function useModelViewer() {
  const [ready, setReady] = useState(() => !!customElements.get("model-viewer"));

  useEffect(() => {
    if (ready) return;

    const existing = document.querySelector("script[data-prana-mv]");
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
    script.setAttribute("data-prana-mv", "");
    script.addEventListener("load", () => setReady(true), { once: true });
    script.addEventListener("error", () => setReady(false), { once: true });
    document.head.appendChild(script);
  }, [ready]);

  return ready;
}

// Owns model-viewer load, default orbit, keyboard, and click-to-spin
export function useHeroCoinModel() {
  const mvReady = useModelViewer();
  const mvRef = useRef<ModelViewerElement | null>(null);
  const spinFrameRef = useRef<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  // Apply default camera orbit once the model is ready
  useEffect(() => {
    const mv = mvRef.current;
    if (!mv) return;

    let cancelled = false;
    const setOrbit = () => {
      const apply = () => {
        if (cancelled) return;
        try {
          mv.setAttribute("camera-orbit", CAMERA_ORBIT_ATTR);
          mv.setAttribute("min-camera-orbit", CAMERA_RADIUS_CLAMP);
          mv.setAttribute("max-camera-orbit", CAMERA_RADIUS_CLAMP);
          mv.cameraOrbit = CAMERA_ORBIT_ATTR;
          mv.jumpCameraToGoal?.();
        } catch {
          /* noop */
        }
      };

      if (mv.updateComplete) {
        mv.updateComplete.then(apply).catch(() => {});
      } else {
        requestAnimationFrame(apply);
      }
    };

    mv.addEventListener("load", setOrbit);
    if (mv.modelIsVisible) setOrbit();

    return () => {
      cancelled = true;
      mv.removeEventListener("load", setOrbit);
    };
  }, [mvReady]);

  // Cancel spin animation and restore controls on unmount
  useEffect(() => () => {
    if (spinFrameRef.current) cancelAnimationFrame(spinFrameRef.current);
    const mv = mvRef.current;
    if (mv) {
      mv.autoRotate = true;
      mv.setAttribute("camera-controls", "");
    }
  }, []);

  const onKeyDown = createOnKeyDown(mvRef);
  const spinCoin = createSpinCoin(mvRef, spinning, setSpinning, spinFrameRef);

  return {
    mvRef,
    mvReady,
    onKeyDown,
    spinCoin,
    coinStyle: COIN_STYLE,
    coinModelUrl: COIN_MODEL_URL,
    cameraOrbitAttr: CAMERA_ORBIT_ATTR,
    cameraRadiusClamp: CAMERA_RADIUS_CLAMP,
  };
}
