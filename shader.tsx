// QUICK TWEAKS:
// <NeuralShaderBackground
//    opacity={1}        // full alpha; do NOT fade the layer itself
//    brightness={0.6}   // global brightness (lower = darker)
//    gamma={1.0}        // tone curve (>1 darkens mids)
//    speed={0.15}       // internal vibration speed (1.0 original)
//    flow={5.0}         // spatial complexity (higher = busier)
//    spin={0.2}         // radians/sec (positive = CCW). 0 disables rotation
// />

import React, { useEffect, useRef } from "react";

export interface NeuralShaderBackgroundProps {
  className?: string;
  opacity?: number;       // CSS layer opacity; keep at 1 for solid dark BG
  speed?: number;         // 1.0 = original; 0.5 = half speed vibration
  flow?: number;          // base field frequency (affects shapes)
  brightness?: number;    // overall multiplier (0.6 ≈ fairly dark)
  gamma?: number;         // tone curve (>1 darkens mids, <1 brightens)
  spin?: number;          // radians/second; positive = CCW rotation of the whole field
  iterations?: number;    // fragment loop count; lower = faster
  maxDpr?: number;        // clamp device pixel ratio; lower = faster
}

export function NeuralShaderBackground({
  className = "",
  opacity = 1,       // CSS layer opacity; keep at 1 for solid dark BG
  speed = 0.15,      // 1.0 = original; 0.5 = half speed vibration
  flow = 5.0,        // base field frequency (affects shapes)
  brightness = 0.6,  // overall multiplier (0.6 ≈ fairly dark)
  gamma = 1.0,       // tone curve (>1 darkens mids, <1 brightens)
  spin = 0.2,        // radians/second; positive = CCW rotation of the whole field
  iterations = 70,   // fragment loop count; lower = faster
  maxDpr = 1.25,     // clamp device pixel ratio; lower = faster
}: NeuralShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const locTimeRef = useRef<WebGLUniformLocation | null>(null);
  const locResRef = useRef<WebGLUniformLocation | null>(null);
  const locSpeedRef = useRef<WebGLUniformLocation | null>(null);
  const locFlowRef = useRef<WebGLUniformLocation | null>(null);
  const locBrightRef = useRef<WebGLUniformLocation | null>(null);
  const locGammaRef = useRef<WebGLUniformLocation | null>(null);
  const locSpinRef = useRef<WebGLUniformLocation | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // WebGL2 gives us #version 300 es and gl_VertexID. If missing on device, consider a webgl fallback.
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    glRef.current = gl;

    // Fullscreen two-triangle quad
    const vert = `#version 300 es
    precision highp float;
    const vec2 verts[6] = vec2[6](
      vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0),
      vec2(-1.0,1.0),  vec2(1.0,-1.0), vec2(1.0,1.0)
    );
    void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }
    `;

    const iterCount = Math.max(20, Math.min(180, iterations)); // safety clamp

    // Fragment shader: XorDev "Neural" (182b) adapted with uniforms for tunability + spin.
    // We expose: speed (s), flow (kFlow), brightness (kBright), gamma (kGamma), spin (kSpin).
    const frag = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 r;         // resolution (xy)
    uniform float t;        // time in seconds
    uniform float s;        // speed scale (1.0 = original, 0.5 = half speed)
    uniform float kFlow;    // spatial frequency scale (was 5.0)
    uniform float kBright;  // brightness multiplier
    uniform float kGamma;   // tone curve (>1 darkens mids)
    uniform float kSpin;    // radians/sec; rotates input field around center
    void main(){
      // Centered, aspect-corrected coordinates in [-?, ?]
      vec2 uv = (gl_FragCoord.xy * 2.0 - r) / r.y;
      // Apply global rotation (spin) around the center
      float a = t * kSpin; float ca = cos(a), sa = sin(a);
      uv = mat2(ca, -sa, sa, ca) * uv;
      // Rebuild the original golfed triplet replacement after rotation
      vec3 base = vec3(uv * r.y, 2.0 - r.y) / r.y;

      vec3 p, v; vec4 o = vec4(0.0);
      float z = 0.0, d = 0.0, l = 0.0;
      // ITERATIONS: increase for finer detail (GPU cost). Kept lean for perf.
      for(float i=0.0; i<${iterCount.toFixed(1)}; i++){
        // Use rotated base to step through the field
        p = z * base;
        p.z += 1.0;
        l = length(p);
        // TIME & FLOW: controls the internal "vibration" of the field
        v = p/(l*l) * kFlow + t * 3.0 * s;
        // Distance step through the field
        d = (dot(cos(v), sin(v.yzx + 0.7)) + 1.8) / 40.0;
        z += d;
        // Accumulate color/energy
        o += (cos(9.0/l + vec4(6.0,1.0,2.0,3.0)) + 1.0) / d;
      }
      // Soft tone mapping + gamma
      vec3 col = tanh(o.xyz / 10000.0);
      col = pow(col * kBright, vec3(kGamma));
      fragColor = vec4(col, 1.0); // keep alpha at 1.0 for an opaque dark background
    }
    `;

    const compile = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
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
    }
    gl.useProgram(prog);

    programRef.current = prog;
    // Uniform locations
    locTimeRef.current   = gl.getUniformLocation(prog, "t");
    locResRef.current    = gl.getUniformLocation(prog, "r");
    locSpeedRef.current  = gl.getUniformLocation(prog, "s");
    locFlowRef.current   = gl.getUniformLocation(prog, "kFlow");
    locBrightRef.current = gl.getUniformLocation(prog, "kBright");
    locGammaRef.current  = gl.getUniformLocation(prog, "kGamma");
    locSpinRef.current   = gl.getUniformLocation(prog, "kSpin");

    // Handle device pixel ratio + viewport
    const resize = () => {
      const dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1)); // cap DPR to keep GPU happy
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (locResRef.current) {
        gl.uniform2f(locResRef.current, canvas.width, canvas.height);
      }
    };

    const onResize = () => { resize(); };
    const start = performance.now();

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const secs = (now - start) * 0.001; // time in seconds
      // Push uniforms every frame so props can animate if you wish
      if (locTimeRef.current) gl.uniform1f(locTimeRef.current, secs);
      if (locSpeedRef.current) gl.uniform1f(locSpeedRef.current, speed);
      if (locFlowRef.current) gl.uniform1f(locFlowRef.current, flow);
      if (locBrightRef.current) gl.uniform1f(locBrightRef.current, brightness);
      if (locGammaRef.current) gl.uniform1f(locGammaRef.current, gamma);
      if (locSpinRef.current) gl.uniform1f(locSpinRef.current, spin);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Bootstrap
    resize();
    window.addEventListener("resize", onResize);
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [speed, flow, brightness, gamma, spin, iterations, maxDpr]);

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 ${className}`} style={{ opacity }}>
      {/* The canvas fills its parent; parent is positioned to cover the page */}
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

export default NeuralShaderBackground;
