// QUICK TWEAKS (defaults match the original ghosts demo):
// <GhostsShaderBackground
//    opacity={1}                 // CSS layer opacity; keep at 1 for solid dark BG
//    speed={1}                   // time scale (1.0 original)
//    brightness={1}              // final shader brightness (1 = original)
//    gamma={1}                   // tone curve (>1 darkens mids)
//    darkTint={0}                // dark overlay strength (0..1)
//    darkTintColor={[0.02, 0.0, 0.08]} // RGB tint color
//    iterations={100}            // outer march steps; original is 100
// />

import React, { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";

export interface GhostsShaderBackgroundProps {
  className?: string;
  opacity?: number;                 // CSS layer opacity
  speed?: number;                   // 1.0 = original shader speed
  brightness?: number;              // final color multiplier; 1 = original
  gamma?: number;                   // tone curve (>1 darkens mids); 1 = original
  darkTint?: number;                // overlay strength for dark tint (0..1); 0 = original
  darkTintColor?: [number, number, number]; // RGB in linear-ish 0..1 range
  iterations?: number;              // outer march loop count; original is 100
  maxDpr?: number;                  // clamp device pixel ratio; lower = faster
  targetFps?: number;               // draw-rate cap
  renderScale?: number;             // additional internal resolution scale (0.5..1.0)
}

export function GhostsShaderBackground({
  className = "",
  opacity = 1,
  speed = 0.1,
  brightness = 0.5,
  gamma = 1,
  darkTint = 0.4,
  darkTintColor = [0.02, 0.0, 0.08],
  iterations = 70,
  maxDpr = 1,
  targetFps = 30,
  renderScale = 1,
}: GhostsShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const locTimeRef = useRef<WebGLUniformLocation | null>(null);
  const locResRef = useRef<WebGLUniformLocation | null>(null);
  const locSpeedRef = useRef<WebGLUniformLocation | null>(null);
  const locBrightRef = useRef<WebGLUniformLocation | null>(null);
  const locGammaRef = useRef<WebGLUniformLocation | null>(null);
  const locDarkTintRef = useRef<WebGLUniformLocation | null>(null);
  const locDarkTintColorRef = useRef<WebGLUniformLocation | null>(null);
  const [darkTintR, darkTintG, darkTintB] = darkTintColor;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Skip WebGL loop when user prefers reduced motion — solid page bg shows through.
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return;

    const vert = `#version 300 es
    precision highp float;
    const vec2 verts[6] = vec2[6](
      vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0),
      vec2(-1.0,1.0),  vec2(1.0,-1.0), vec2(1.0,1.0)
    );
    void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }
    `;

    const iterCount = Math.max(20, Math.min(140, iterations));

    // Ghosts march, adapted from the compact shader in ghostsShader:
    // fragColor = 0; for i < 100: ray from pixel, spin, fractal cosine fold, step z.
    // fragColor = tanh(fragColor * fragColor / 1e7)
    const frag = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 r;
    uniform float t;
    uniform float kSpeed;
    uniform float kBright;
    uniform float kGamma;
    uniform float kDarkTint;
    uniform vec3 kDarkTintColor;

    void main(){
      vec4 o = vec4(0.0);
      float z = 0.0;
      float d = 1.0;
      float tt = t * kSpeed;

      for(float i = 0.0; i < ${iterCount.toFixed(1)}; i++){
        vec3 p = z * normalize(gl_FragCoord.rgb * 2.0 - vec3(r, 1.0).xyy);
        p.z -= 5.0 * tt;
        p.xy *= mat2(cos(z * 0.1 + tt * 0.1 + vec4(0.0, 33.0, 11.0, 0.0)));

        // d starts at 1 and divides by 0.7 while d < 9: exactly 7 steps.
        d = 1.0;
        for(int k = 0; k < 7; k++){
          p += cos(p.yzx * d + tt) / d;
          d /= 0.7;
        }

        d = 0.02 + abs(2.0 - dot(cos(p), sin(p.yzx * 0.6))) / 8.0;
        z += d;
        o += vec4(z / 7.0, 2.0, 3.0, 1.0) / d;
      }

      vec3 col = tanh(o.rgb * o.rgb / 1e7);
      col = pow(max(col * kBright, 0.0), vec3(kGamma));
      col = mix(col, kDarkTintColor, clamp(kDarkTint, 0.0, 1.0));
      fragColor = vec4(col, 1.0);
    }
    `;

    const compile = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    locTimeRef.current = gl.getUniformLocation(prog, "t");
    locResRef.current = gl.getUniformLocation(prog, "r");
    locSpeedRef.current = gl.getUniformLocation(prog, "kSpeed");
    locBrightRef.current = gl.getUniformLocation(prog, "kBright");
    locGammaRef.current = gl.getUniformLocation(prog, "kGamma");
    locDarkTintRef.current = gl.getUniformLocation(prog, "kDarkTint");
    locDarkTintColorRef.current = gl.getUniformLocation(prog, "kDarkTintColor");

    const resize = () => {
      const dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1));
      const scale = Math.max(0.5, Math.min(1, renderScale));
      const effectiveDpr = dpr * scale;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * effectiveDpr));
      canvas.height = Math.max(1, Math.floor(h * effectiveDpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (locResRef.current) {
        gl.uniform2f(locResRef.current, canvas.width, canvas.height);
      }
    };

    const start = performance.now();
    let lastDraw = start;
    const minFrameMs = targetFps > 0 ? 1000 / Math.max(1, targetFps) : 0;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      if (document.hidden) return;
      if (minFrameMs > 0 && now - lastDraw < minFrameMs) return;
      lastDraw = now;

      const secs = (now - start) * 0.001;
      if (locTimeRef.current) gl.uniform1f(locTimeRef.current, secs);
      if (locSpeedRef.current) gl.uniform1f(locSpeedRef.current, speed);
      if (locBrightRef.current) gl.uniform1f(locBrightRef.current, brightness);
      if (locGammaRef.current) gl.uniform1f(locGammaRef.current, gamma);
      if (locDarkTintRef.current) gl.uniform1f(locDarkTintRef.current, darkTint);
      if (locDarkTintColorRef.current) {
        gl.uniform3f(locDarkTintColorRef.current, darkTintR, darkTintG, darkTintB);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [
    speed,
    brightness,
    gamma,
    darkTint,
    darkTintR,
    darkTintG,
    darkTintB,
    iterations,
    maxDpr,
    targetFps,
    renderScale,
    prefersReducedMotion,
  ]);

  return (
    <div className={`fixed inset-0 pointer-events-none select-none z-0 ${className}`} style={{ opacity }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

export default GhostsShaderBackground;
