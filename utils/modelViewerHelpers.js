// Parse "xdeg ydeg zdeg" orientation into degrees
export const parseOrientationDeg = (orientation) => {
  const matches = Array.from(String(orientation || "").matchAll(/(-?\d+(?:\.\d+)?)deg/gi));
  if (matches.length >= 3) return matches.slice(0, 3).map((m) => parseFloat(m[1]));
  return [0, 0, 0];
};

export const formatOrientationDeg = (x, y, z) => `${x}deg ${y}deg ${z}deg`;

// Keyboard access: ←/→ rotate
export const createOnKeyDown = (mvRef) => (e) => {
  if (!mvRef.current) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    try {
      const mv = mvRef.current;
      const orbit = mv.getCameraOrbit ? mv.getCameraOrbit() : null;
      if (orbit) {
        const delta = e.key === "ArrowLeft" ? -10 : 10; // deg
        const thetaDeg = orbit.theta * (180 / Math.PI) + delta;
        const phiDeg = orbit.phi * (180 / Math.PI);
        const orbitString = `${thetaDeg.toFixed(1)}deg ${phiDeg.toFixed(1)}deg ${orbit.radius.toFixed(2)}m`;
        mv.cameraOrbit = orbitString;
        mv.jumpCameraToGoal?.();
      }
    } catch {}
  }
};

// Click-to-spin
export const createSpinCoin = (mvRef, spinning, setSpinning, spinFrameRef) => () => {
  const mv = mvRef.current;
  if (!mv || spinning) return;

  const SPIN_SPEED_DEG_PER_S = 360;
  const durationMs = (360 / SPIN_SPEED_DEG_PER_S) * 1000; // 12s
  const [xDeg, yDeg, zDeg] = parseOrientationDeg(mv.getAttribute("orientation") || mv.orientation || "0deg 0deg 0deg");
  const targetYDeg = yDeg + 360;
  const autoWasOn = mv.autoRotate;
  const hadCameraControls = mv.hasAttribute("camera-controls");

  mv.autoRotate = false;
  if (hadCameraControls) mv.removeAttribute("camera-controls");
  setSpinning(true);

  const start = performance.now();
  const animate = (now) => {
    const progress = Math.min((now - start) / durationMs, 1);
    const currentY = yDeg + (targetYDeg - yDeg) * progress;
    mv.orientation = formatOrientationDeg(xDeg, currentY, zDeg);
    if (progress < 1) {
      spinFrameRef.current = requestAnimationFrame(animate);
    } else {
      mv.orientation = formatOrientationDeg(xDeg, targetYDeg, zDeg);
      if (autoWasOn) mv.autoRotate = true;
      if (hadCameraControls) mv.setAttribute("camera-controls", "");
      spinFrameRef.current = null;
      setSpinning(false);
    }
  };

  spinFrameRef.current = requestAnimationFrame(animate);
};
