"use client";

// =====================================================================
// window-3d.tsx — a three.js MASSING model of the solved window.
//
// Consumes the SAME QuoteGeometry the 2D preview uses (no engine change):
// each profile rect is extruded into a box by a constant catalog-ish depth.
// Front faces carry the OUTSIDE colour, back faces the INSIDE colour, so a
// dual-colour finish reads in 3D. Built with plain three.js (+ OrbitControls)
// so it adds a single dependency and no React-version peer constraints. The
// whole module is lazy-loaded by the configurator via next/dynamic(ssr:false),
// so it never enters the server bundle or blocks the 2D preview's first paint.
// =====================================================================

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { QuoteGeometry, Rect } from "@/lib/types";

// Constant extrusion depths (mm) — a massing model, NOT fabrication values.
const FRAME_DEPTH = 64;
const SASH_DEPTH = 70;
const GLASS_DEPTH = 6;
const SASH_Z = 8; // sash sits proud of the frame toward the viewer
const PROFILE_HEX = 0xdfe3e8; // default grey when a colour carries no hex

export interface Window3DProps {
  geometry: QuoteGeometry;
  insideHex?: string;
  outsideHex?: string;
}

export default function Window3D({ geometry, insideHex, outsideHex }: Window3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Detect WebGL once at mount (lazy init; this component is client-only).
  const [unsupported] = useState(() => !hasWebGL());

  useEffect(() => {
    const mount = mountRef.current;
    if (unsupported || !mount || !geometry.outer || !geometry.cells) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL became unavailable; the fallback message handles unsupported up front
    }

    const outside = new THREE.Color(outsideHex ?? cssOr(PROFILE_HEX, insideHex));
    const inside = new THREE.Color(insideHex ?? outsideHex ?? `#${PROFILE_HEX.toString(16)}`);

    const O = geometry.outer;
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);

    // Frame ring (4 bars) from outer + daylight.
    const daylight = innerOf(O);
    for (const bar of ringBars(O, daylight)) addBox(group, bar, FRAME_DEPTH, 0, outside, inside);

    // Transoms & mullions.
    for (const t of geometry.transoms ?? []) addBox(group, t.rect, FRAME_DEPTH, 0, outside, inside);
    for (const m of geometry.mullions ?? []) addBox(group, m.rect, FRAME_DEPTH, 0, outside, inside);

    // Cells: sash ring (proud) + a translucent glass pane.
    for (const c of geometry.cells) {
      if (c.sashOuter && c.sashInner) {
        for (const bar of ringBars(c.sashOuter, c.sashInner)) addBox(group, bar, SASH_DEPTH, SASH_Z, outside, inside);
      }
      addGlass(group, c.glassRect);
    }

    // Centre the model at the origin and flip Y (geometry is y-down).
    group.position.set(-(O.x + O.w / 2), O.y + O.h / 2, 0);
    group.scale.y = -1;

    // Lighting.
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(0.6, 1, 1.4);
    scene.add(key);

    // Camera framing the window.
    const span = Math.max(O.w, O.h);
    const camera = new THREE.PerspectiveCamera(45, 1, 1, span * 12);
    camera.position.set(span * 0.55, span * 0.45, span * 1.15);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [geometry, insideHex, outsideHex, unsupported]);

  if (unsupported) {
    return (
      <div className="flex h-full min-h-[360px] w-full items-center justify-center text-sm text-slate-500">
        3D view unavailable (WebGL not supported). Switch back to the 2D preview.
      </div>
    );
  }

  return <div ref={mountRef} className="h-full min-h-[360px] w-full" />;
}

// ---- geometry helpers (pure) ----------------------------------------

/** Resolve the inner opening rect by insetting the outer by the frame face. */
function innerOf(outer: Rect): Rect {
  const face = 64; // nominal frame face (mm); massing approximation
  return { x: outer.x + face, y: outer.y + face, w: outer.w - 2 * face, h: outer.h - 2 * face };
}

/** Four bars (top/bottom/left/right) of the ring between an outer and inner rect. */
function ringBars(o: Rect, i: Rect): Rect[] {
  return [
    { x: o.x, y: o.y, w: o.w, h: i.y - o.y },                       // top
    { x: o.x, y: i.y + i.h, w: o.w, h: o.y + o.h - (i.y + i.h) },   // bottom
    { x: o.x, y: i.y, w: i.x - o.x, h: i.h },                       // left
    { x: i.x + i.w, y: i.y, w: o.x + o.w - (i.x + i.w), h: i.h },   // right
  ].filter((r) => r.w > 0.5 && r.h > 0.5);
}

function addBox(
  group: THREE.Group,
  r: Rect,
  depth: number,
  z: number,
  outside: THREE.Color,
  inside: THREE.Color,
): void {
  const geo = new THREE.BoxGeometry(r.w, r.h, depth);
  const side = new THREE.MeshStandardMaterial({ color: outside, roughness: 0.7, metalness: 0.05 });
  const back = new THREE.MeshStandardMaterial({ color: inside, roughness: 0.7, metalness: 0.05 });
  // Box face order: +x,-x,+y,-y,+z(front/outside),-z(back/inside).
  const mats = [side, side, side, side, side.clone(), back];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.position.set(r.x + r.w / 2, r.y + r.h / 2, z);
  group.add(mesh);
}

function addGlass(group: THREE.Group, r: Rect): void {
  const geo = new THREE.BoxGeometry(r.w, r.h, GLASS_DEPTH);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xbfe3ef,
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r.x + r.w / 2, r.y + r.h / 2, 0);
  group.add(mesh);
}

function cssOr(fallbackHex: number, hex?: string): string {
  return hex ?? `#${fallbackHex.toString(16)}`;
}

/** True if the browser can create a WebGL context. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}
