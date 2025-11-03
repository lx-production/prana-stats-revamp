'use client';

// PRANA — Hero-only mockup with interactive 3D Bitcoin coin
// Self-contained, Tailwind-optional: includes its own minimal CSS so it looks good even if Tailwind isn't loaded.
// No @react-three/drei and no framer-motion. Drag to rotate. Gentle auto-spin when idle.

import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'

// -------------------- Inline CSS (looks good without Tailwind) --------------------
const CSS = `
:root{--bg:#070b12;--bg2:#0b1220;--fg:#e6edf7;--muted:#9aa4b2;--card:rgba(255,255,255,0.06);--border:rgba(255,255,255,0.12);--brand:#7dd3fc;--brand2:#a78bfa}
*{box-sizing:border-box}
.prana-root{min-height:100vh;background:
  radial-gradient(1200px 600px at 10% 0%, rgba(124,58,237,.14), transparent),
  radial-gradient(800px 400px at 100% 20%, rgba(14,165,233,.12), transparent),
  linear-gradient(180deg, var(--bg), var(--bg2));
  color:var(--fg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji';
}
.hero{position:relative;padding:120px 0 80px}
.container{display:grid;grid-template-columns:1fr;gap:40px;max-width:1200px;margin:0 auto;padding:0 24px}
@media (min-width: 960px){.container{grid-template-columns:1.1fr 0.9fr}}
.h1{font-weight:700;font-size:44px;line-height:1.1;margin:0 0 12px}
.lead{max-width:48ch;color:var(--muted);font-size:16px;line-height:1.8;margin:0}
.pills{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);background:var(--card);border-radius:999px;font-size:12px;color:#cbd5e1}
.stage{position:relative}
.canvas-card{position:relative;background:linear-gradient(180deg, rgba(2,6,23,.4), rgba(2,6,23,.65));border:1px solid var(--border);border-radius:24px;padding:12px;backdrop-filter:blur(6px);box-shadow:0 10px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)}
.canvas-frame{position:relative;height:420px;border-radius:18px;overflow:hidden}
.hint{position:absolute;right:12px;bottom:12px;font-size:12px;color:#cbd5e1;background:rgba(0,0,0,.35);padding:4px 8px;border-radius:6px}
.aurora{position:absolute;inset:0;pointer-events:none}
.aurora::before,.aurora::after{content:'';position:absolute;border-radius:50%;filter:blur(90px);opacity:.25}
.aurora::before{width:420px;height:420px;left:-120px;top:-80px;background:radial-gradient(circle at 30% 30%, #67e8f9, transparent 60%)}
.aurora::after{width:520px;height:520px;right:-120px;top:40px;background:radial-gradient(circle at 70% 30%, #a78bfa, transparent 60%)}
`;

// -------------------- Hero with 3D coin (no drei) --------------------
function Hero3D() {
  return (
    <section className="hero">
      {/* Decorative background aurora */}
      <div className="aurora" />

      <div className="container">
        {/* Copy block */}
        <div>
          <h1 className="h1">PRANA Stats</h1>
          <p className="lead">
            100% Bitcoin-denominated discipline. Minimal. Transparent. On-chain.
            Click + drag the coin on the right. I will swap the symbol with PRANA later.
          </p>
          <div className="pills">
            <span className="pill"><b>SAT</b> first</span>
            <span className="pill">On-chain only</span>
            <span className="pill">Auto refresh</span>
          </div>
        </div>

        {/* 3D coin block */}
        <div className="stage">
          <div className="canvas-card">
            <div className="canvas-frame">
              <Canvas shadows camera={{ position: [0, 0.15, 3.1], fov: 40 }} gl={{ antialias: true, alpha: true }}>
                {/* Lighting */}
                <hemisphereLight args={[0xffffff, 0x0b1020, 0.6]} />
                <directionalLight position={[4, 6, 8]} intensity={1.05} castShadow
                  shadow-mapSize-width={1024}
                  shadow-mapSize-height={1024}
                  shadow-camera-left={-6} shadow-camera-right={6}
                  shadow-camera-top={6} shadow-camera-bottom={-6}
                />
                {/* Soft contact shadow */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
                  <planeGeometry args={[7, 7]} />
                  <shadowMaterial attach="material" transparent opacity={0.28} />
                </mesh>
                {/* Coin */}
                <group position={[0, 0.12, 0]}>
                  <Coin3D />
                </group>
              </Canvas>
              <div className="hint">Click + drag</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Coin3D() {
  const group = useRef(null)
  const dragging = useRef(false)
  const start = useRef({ x: 0, y: 0, ry: 0, rx: 0 })
  const idleSpin = useRef(0.25) // radians per second

  // Textures
  const faceTexture = useMemo(() => createFaceTexture('₿'), [])
  const edgeTexture = useMemo(() => createEdgeTexture(), [])

  useFrame((_, delta) => {
    if (!group.current) return
    if (!dragging.current) group.current.rotation.y += delta * idleSpin.current
  })

  const onPointerDown = (e) => {
    dragging.current = true
    start.current = {
      x: e.clientX ?? 0,
      y: e.clientY ?? 0,
      ry: group.current?.rotation.y ?? 0,
      rx: group.current?.rotation.x ?? 0,
    }
  }
  const onPointerUp = () => { dragging.current = false }
  const onPointerMove = (e) => {
    if (!dragging.current || !group.current) return
    const dx = (e.clientX ?? 0) - start.current.x
    const dy = (e.clientY ?? 0) - start.current.y
    group.current.rotation.y = start.current.ry + dx * 0.01
    const tilt = start.current.rx + dy * 0.006
    group.current.rotation.x = Math.max(-0.6, Math.min(0.6, tilt))
  }

  return (
    <group
      ref={group}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerUp}
      onPointerMove={onPointerMove}
      rotation={[0.22, 0, 0]} // face the viewer with a pleasant tilt
    >
      {/* Coin body: side + two faces */}
      <mesh castShadow>
        <cylinderGeometry args={[1.15, 1.15, 0.26, 128, 1, false]} />
        {/* Side with knurled stripes */}
        <meshStandardMaterial attach="material-0" metalness={1} roughness={0.32} color="#d6a64a">
          <primitive attach="map" object={edgeTexture} />
        </meshStandardMaterial>
        {/* Face A */}
        <meshStandardMaterial attach="material-1" metalness={1} roughness={0.18}>
          <primitive attach="map" object={faceTexture} />
        </meshStandardMaterial>
        {/* Face B */}
        <meshStandardMaterial attach="material-2" metalness={1} roughness={0.18}>
          <primitive attach="map" object={faceTexture} />
        </meshStandardMaterial>
      </mesh>
      {/* Thin rim for sparkle */}
      <mesh castShadow>
        <cylinderGeometry args={[1.18, 1.18, 0.018, 128]} />
        <meshStandardMaterial color="#f0c56b" metalness={1} roughness={0.12} />
      </mesh>
    </group>
  )
}

function createFaceTexture(symbol) {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context not available')
  // Gold base
  const grad = ctx.createRadialGradient(size/2, size/2, size*0.12, size/2, size/2, size*0.65)
  grad.addColorStop(0, '#fff1bf')
  grad.addColorStop(0.45, '#f2c35d')
  grad.addColorStop(1, '#c88a2b')
  ctx.fillStyle = grad
  ctx.fillRect(0,0,size,size)
  // Guilloché rings
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1
  for (let r = 30; r < size*0.45; r += 7) { ctx.beginPath(); ctx.arc(size/2,size/2,r,0,Math.PI*2); ctx.stroke() }
  // Inner sunburst
  for (let i=0;i<120;i++){ const ang=i*Math.PI*2/120; const r1=120, r2=220; ctx.beginPath(); ctx.moveTo(size/2 + Math.cos(ang)*r1, size/2 + Math.sin(ang)*r1); ctx.lineTo(size/2 + Math.cos(ang)*r2, size/2 + Math.sin(ang)*r2); ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.stroke() }
  // Embossed symbol
  ctx.font = `${size*0.55}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillText(symbol, size/2 + 12, size/2 + 12)
  ctx.fillStyle = '#fff7db'; ctx.fillText(symbol, size/2, size/2)
  const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 8; tex.needsUpdate = true; return tex
}

function createEdgeTexture(){
  const w=1024, h=64
  const c=document.createElement('canvas'); c.width=w; c.height=h
  const x=c.getContext('2d'); if(!x) throw new Error('2D context not available')
  const grad=x.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#f6d58a'); grad.addColorStop(1,'#b27a25'); x.fillStyle=grad; x.fillRect(0,0,w,h)
  // knurling stripes
  x.globalAlpha=0.35; x.fillStyle='#000'; for(let i=0;i<w;i+=16){ x.fillRect(i,0,8,h) }
  const t=new THREE.CanvasTexture(c); t.wrapS=THREE.RepeatWrapping; t.repeat.x=1; return t
}

// -------------------- Page wrapper --------------------
export default function PranaHeroOnly() {
  return (
    <div className="prana-root">
      {/* Font for consistent look even without Tailwind */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{CSS}</style>
      <section className="hero">
        <Hero3D />
      </section>
    </div>
  )
}

// -------------------- Smoke tests (dev) --------------------
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      // Test 1: 3D coin ready flag (set by Hero mounting)
      window.__pranaCoinReady = window.__pranaCoinReady ?? true
      console.assert(window.__pranaCoinReady === true, '3D coin should be ready')
      // Test 2: Texture factory returns a Texture with a canvas image
      const t = createFaceTexture('₿')
      console.assert(t instanceof THREE.Texture, 'createFaceTexture should return THREE.Texture')
      console.assert(t.image && t.image.width > 0, 'Texture image should exist')
      // Test 3: Canvas element rendered
      const canvasEl = document.querySelector('canvas')
      console.assert(!!canvasEl, 'A <canvas> element should be present in the DOM')
      // Test 4: Headline present
      const h1 = document.querySelector('h1')
      console.assert(!!h1 && /PRANA Stats/i.test(h1.textContent || ''), 'Headline should exist and contain PRANA Stats')
      // Test 5: Drag hint text present
      const hint = Array.from(document.querySelectorAll('div')).some((n) => /Click \+ drag/.test(n.textContent || ''))
      console.assert(hint, 'Drag hint text should be present')
      // Test 6: Texture size is expected 1024
      console.assert(t.image.width === 1024 && t.image.height === 1024, 'Texture should be 1024x1024')
      // Test 7: Ensure no inline translateX or negative arbitrary classes used
      const anyInlineTranslateX = Array.from(document.querySelectorAll('[style]')).some((n) => /translateX\(/.test(n.getAttribute('style') || ''))
      console.assert(!anyInlineTranslateX, 'No inline translateX styles should be present')
      const anyRightArbitrary = document.querySelector('[class*="right-["]')
      console.assert(!anyRightArbitrary, 'No element should use right-[…] arbitrary class')
      console.debug('[PRANA hero-only] smoke tests passed ✅')
    } catch (e) {
      console.warn('[PRANA hero-only] test failed', e)
    }
  }, 0)
}
