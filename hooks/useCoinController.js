import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const DEG_TO_RAD = Math.PI / 180;

export function useCoinController({
  coinSrc,
  isReducedMotion,
  onVelocityChange,
  snapbackDelay,
  snapbackTarget,
  onReady,
  onError,
}) {
  const groupRef = useRef(null);
  const ringMaterialRef = useRef(null);
  const draggingRef = useRef(false);
  const pointerLastRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef([0, 0]);
  const ringOpacityRef = useRef(0);
  const timeRef = useRef(0);
  const lastInteractionRef = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const hasErroredRef = useRef(false);

  let gltf;
  try {
    gltf = useGLTF(coinSrc, true);
  } catch (error) {
    gltf = null;
    if (!hasErroredRef.current && onError) {
      hasErroredRef.current = true;
      const schedule =
        typeof queueMicrotask === "function"
          ? queueMicrotask
          : (cb) => Promise.resolve().then(cb);
      schedule(() => onError(error));
    }
  }

  useEffect(() => {
    if (!gltf || !onReady) return undefined;
    onReady();
    return undefined;
  }, [gltf, onReady]);

  const updateVelocity = useCallback(
    (vx, vy) => {
      velocityRef.current = [vx, vy];
      if (onVelocityChange) {
        const speed = Math.hypot(vx, vy);
        onVelocityChange(speed);
      }
    },
    [onVelocityChange]
  );

  const registerInteraction = useCallback(() => {
    lastInteractionRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
  }, []);

  const impulseSpin = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    registerInteraction();
    group.rotation.y += 15 * DEG_TO_RAD;
    updateVelocity(4.5, velocityRef.current[1]);
    ringOpacityRef.current = 0.8;
  }, [registerInteraction, updateVelocity]);

  const nudge = useCallback(
    ({ dx = 0, dy = 0 }) => {
      const group = groupRef.current;
      if (!group) return;
      registerInteraction();
      const yawDelta = dx * 0.06;
      const pitchDelta = dy * 0.04;
      group.rotation.y += yawDelta;
      group.rotation.x = THREE.MathUtils.clamp(
        group.rotation.x + pitchDelta,
        -0.5,
        0.55
      );
      updateVelocity(yawDelta * 60, pitchDelta * 60);
      ringOpacityRef.current = Math.min(0.9, ringOpacityRef.current + 0.35);
    },
    [registerInteraction, updateVelocity]
  );

  const handlePointerDown = useCallback(
    (event) => {
      event.stopPropagation();
      draggingRef.current = true;
      pointerLastRef.current = { x: event.clientX, y: event.clientY };
      registerInteraction();
    },
    [registerInteraction]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      const group = groupRef.current;
      if (!group) return;

      const dx = (event.clientX - pointerLastRef.current.x) / 200;
      const dy = (event.clientY - pointerLastRef.current.y) / 200;
      pointerLastRef.current = { x: event.clientX, y: event.clientY };

      const yawDelta = dx * 1.25;
      const pitchDelta = dy * 1.0;

      group.rotation.y += yawDelta;
      group.rotation.x = THREE.MathUtils.clamp(
        group.rotation.x + pitchDelta,
        -0.6,
        0.6
      );

      updateVelocity(yawDelta * 60, pitchDelta * 60);
      ringOpacityRef.current = 0.9;
      registerInteraction();
    },
    [registerInteraction, updateVelocity]
  );

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    pointerLastRef.current = { x: 0, y: 0 };
    registerInteraction();
  }, [registerInteraction]);

  const pointerHandlers = useMemo(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: () => handlePointerUp(),
      onPointerCancel: () => handlePointerUp(),
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp]
  );

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;

    timeRef.current += dt;
    group.position.y = Math.sin(timeRef.current * 1.05) * 0.05;

    const [vx, vy] = velocityRef.current;
    const isDragging = draggingRef.current;

    if (!isDragging) {
      group.rotation.y += vx * dt;
      group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + vy * dt, -0.6, 0.6);

      const decay = Math.exp(-dt * 4.2);
      velocityRef.current = [vx * decay, vy * decay];
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!isDragging && snapbackDelay && snapbackTarget && now - lastInteractionRef.current > snapbackDelay) {
      const relax = 1 - Math.exp(-dt * 2.6);
      group.rotation.x += (snapbackTarget.x - group.rotation.x) * relax;
      group.rotation.y += (snapbackTarget.y - group.rotation.y) * relax;
      velocityRef.current = [velocityRef.current[0] * 0.65, velocityRef.current[1] * 0.65];
    }

    if (!isReducedMotion && ringMaterialRef.current) {
      const speed = Math.hypot(velocityRef.current[0], velocityRef.current[1]);
      ringOpacityRef.current = Math.min(
        0.9,
        Math.max(ringOpacityRef.current * Math.exp(-dt * 6.5), isDragging ? 0.7 : speed * 10)
      );
      ringMaterialRef.current.opacity = ringOpacityRef.current * 0.6;
    } else if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = 0;
    }

    if (onVelocityChange) {
      const speed = Math.hypot(velocityRef.current[0], velocityRef.current[1]);
      onVelocityChange(speed);
    }
  });

  useEffect(() => () => {
    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = 0;
    }
  }, []);

  return {
    gltf,
    groupRef,
    ringMaterialRef,
    pointerHandlers,
    impulseSpin,
    nudge,
    registerInteraction,
  };
}

useGLTF.preload?.("/prana_mock_coin2.glb");

export default useCoinController;

