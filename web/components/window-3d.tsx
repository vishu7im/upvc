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
import type { QuoteGeometry, Rect, SolvedCell } from "@/lib/types";

// Constant extrusion depths (mm) — a massing model, NOT fabrication values.
const FRAME_DEPTH = 64;
const SASH_DEPTH = 70;
const GLASS_DEPTH = 6;
const SASH_Z = 8; // sash sits proud of the frame toward the viewer
const PROFILE_HEX = 0xdfe3e8; // default grey when a colour carries no hex
const METAL_HEX = 0x9aa3ad;
const DARK_GASKET_HEX = 0x20252b;

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
    for (const bar of ringBars(O, daylight)) addProfileBox(group, bar, FRAME_DEPTH, 0, outside, inside);

    // Transoms & mullions.
    for (const t of geometry.transoms ?? []) addProfileBox(group, t.rect, FRAME_DEPTH, 0, outside, inside);
    for (const m of geometry.mullions ?? []) addProfileBox(group, m.rect, FRAME_DEPTH, 0, outside, inside);

    if (geometry.cill) addCill(group, geometry.cill.rect, outside, inside);

    // Cells: sash ring (proud) + a translucent glass pane.
    for (const c of geometry.cells) {
      if (c.sashOuter && c.sashInner) {
        for (const bar of ringBars(c.sashOuter, c.sashInner)) addProfileBox(group, bar, SASH_DEPTH, SASH_Z, outside, inside);
        addGlassGasket(group, c.sashInner);
      }
      addGlass(group, c.glassRect);
      addHardwareForCell(group, c);
    }

    if (geometry.cells.some((c) => c.content?.startsWith("sliding-"))) {
      addSlidingTrack(group, O);
    }

    // Centre the model at the origin and flip Y (geometry is y-down).
    group.position.set(-(O.x + O.w / 2), O.y + O.h / 2, 0);
    group.scale.y = -1;

    // Lighting.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8dee8, 1.15));
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(0.6, 1, 1.4);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-1, -0.4, 0.7);
    scene.add(fill);

    // Camera framing the window.
    const span = Math.max(O.w, O.h);
    const camera = new THREE.PerspectiveCamera(45, 1, 1, span * 12);
    camera.position.set(span * 0.55, span * 0.45, span * 1.15);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = span * 0.35;
    controls.maxDistance = span * 4;
    controls.target.set(0, 0, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
        if (o instanceof THREE.Line) {
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

function addProfileBox(
  group: THREE.Group,
  r: Rect,
  depth: number,
  z: number,
  outside: THREE.Color,
  inside: THREE.Color,
): void {
  const geo = new THREE.BoxGeometry(r.w, r.h, depth);
  const side = new THREE.MeshStandardMaterial({ color: outside, roughness: 0.62, metalness: 0.03 });
  const back = new THREE.MeshStandardMaterial({ color: inside, roughness: 0.68, metalness: 0.03 });
  // Box face order: +x,-x,+y,-y,+z(front/outside),-z(back/inside).
  const mats = [side, side, side, side, side.clone(), back];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.position.set(r.x + r.w / 2, r.y + r.h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x4b5563, transparent: true, opacity: 0.16 }),
  );
  edge.position.copy(mesh.position);
  group.add(edge);

  const frontZ = z + depth / 2 + 0.7;
  addRectLine(group, r, frontZ, 0xffffff, 0.2);
  addProfileGroove(group, r, frontZ);
}

function addGlass(group: THREE.Group, r: Rect): void {
  const geo = new THREE.BoxGeometry(r.w, r.h, GLASS_DEPTH);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe3ef,
    transparent: true,
    opacity: 0.34,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r.x + r.w / 2, r.y + r.h / 2, -8);
  mesh.receiveShadow = true;
  group.add(mesh);
  addRectLine(group, r, GLASS_DEPTH / 2 - 5, 0x7ba6b4, 0.42);
  addGlassReflection(group, r, -2);
}

function addCill(group: THREE.Group, r: Rect, outside: THREE.Color, inside: THREE.Color): void {
  const body = {
    x: r.x - 30,
    y: r.y + Math.max(8, r.h * 0.08),
    w: r.w + 60,
    h: Math.max(34, r.h * 0.34),
  };
  addProfileBox(group, body, 110, 20, outside, inside);
  addHardwareBox(group, { x: body.x, y: body.y + body.h - 8, w: body.w, h: 8 }, 116, 28, 0x6b7280, 0.12);
}

function addGlassGasket(group: THREE.Group, r: Rect): void {
  const thickness = Math.max(5, Math.min(10, Math.min(r.w, r.h) * 0.025));
  for (const bar of ringBars(r, insetRect(r, thickness))) {
    addHardwareBox(group, bar, 7, SASH_Z + SASH_DEPTH / 2 + 1, DARK_GASKET_HEX, 0.88);
  }
}

function addProfileGroove(group: THREE.Group, r: Rect, z: number): void {
  const inset = Math.min(12, Math.max(4, Math.min(r.w, r.h) * 0.18));
  if (r.w <= inset * 2 || r.h <= inset * 2) return;
  addRectLine(group, insetRect(r, inset), z + 0.4, 0x1f2937, 0.12);
}

function addHardwareForCell(group: THREE.Group, cell: SolvedCell): void {
  const face = cell.sashOuter ?? cell.outer;
  const z = (cell.sashOuter ? SASH_Z + SASH_DEPTH / 2 : FRAME_DEPTH / 2) + 8;
  const content = cell.content ?? "fixed";

  if (content === "fixed" || content === "sliding-fixed") return;

  if (content === "casement-top-hung") {
    addHandle(group, { x: face.x + face.w / 2 - 11, y: face.y + face.h - 84, w: 22, h: 76 }, z, "vertical");
    addTopHinges(group, face, z);
    addRestrictorStay(group, face, "left", z);
    addRestrictorStay(group, face, "right", z);
    return;
  }

  if (content === "casement-side-left" || content === "tilt-turn" || content === "door-left") {
    addHandle(group, latchHandleRect(face, "right", content.startsWith("door-")), z, content.startsWith("door-") ? "lever-right" : "vertical");
    addVerticalHinges(group, face, "left", content.startsWith("door-") ? 3 : 2, z);
    if (content === "door-left") addDoorLock(group, face, "right", z);
    if (content === "tilt-turn") addTiltTurnMarker(group, face, z);
    return;
  }

  if (content === "casement-side-right" || content === "door-right") {
    addHandle(group, latchHandleRect(face, "left", content.startsWith("door-")), z, content.startsWith("door-") ? "lever-left" : "vertical");
    addVerticalHinges(group, face, "right", content.startsWith("door-") ? 3 : 2, z);
    if (content === "door-right") addDoorLock(group, face, "left", z);
    return;
  }

  if (content === "sliding-slide-left" || content === "sliding-slide-right") {
    const side = content === "sliding-slide-left" ? "left" : "right";
    const x = side === "left" ? face.x + 34 : face.x + face.w - 54;
    addPatioPull(group, { x, y: face.y + face.h * 0.38, w: 20, h: face.h * 0.24 }, z);
    addRollers(group, face, z);
  }
}

function addHandle(group: THREE.Group, r: Rect, z: number, mode: "vertical" | "lever-left" | "lever-right"): void {
  addHardwareBox(group, r, 10, z, METAL_HEX, 0.95);
  const knob = { x: r.x + r.w / 2 - 8, y: r.y + r.h / 2 - 8, w: 16, h: 16 };
  addRoundHardware(group, knob.x + knob.w / 2, knob.y + knob.h / 2, 8, 5, z + 7, METAL_HEX);

  if (mode === "vertical") {
    addHardwareBox(group, { x: r.x + r.w / 2 - 5, y: r.y + r.h / 2 - 28, w: 10, h: 56 }, 12, z + 8, 0x6f7782, 1);
    return;
  }

  const leverW = Math.max(44, r.h * 0.65);
  const leverX = mode === "lever-left" ? r.x - leverW + 10 : r.x + r.w - 10;
  addHardwareBox(group, { x: leverX, y: r.y + r.h / 2 - 6, w: leverW, h: 12 }, 12, z + 10, 0x6f7782, 1);
}

function addPatioPull(group: THREE.Group, r: Rect, z: number): void {
  addHardwareBox(group, r, 10, z, METAL_HEX, 0.95);
  const railInset = 7;
  addHardwareBox(group, { x: r.x + railInset, y: r.y + 18, w: r.w - railInset * 2, h: r.h - 36 }, 14, z + 8, 0x6f7782, 1);
}

function addDoorLock(group: THREE.Group, face: Rect, side: "left" | "right", z: number): void {
  const x = side === "left" ? face.x + 36 : face.x + face.w - 54;
  addRoundHardware(group, x + 9, face.y + face.h * 0.53, 7, 5, z + 8, 0x707984);
  addHardwareBox(group, { x, y: face.y + face.h * 0.52 + 14, w: 18, h: 36 }, 8, z + 6, 0x707984, 0.9);
}

function addVerticalHinges(group: THREE.Group, face: Rect, side: "left" | "right", count: number, z: number): void {
  const x = side === "left" ? face.x + 12 : face.x + face.w - 12;
  for (let i = 0; i < count; i++) {
    const y = face.y + face.h * ((i + 1) / (count + 1));
    addHingeCylinder(group, x, y, 8, Math.min(58, face.h * 0.12), z + 8, "vertical");
    addHardwareBox(group, { x: x - 12, y: y - 16, w: 24, h: 32 }, 5, z + 2, 0x8f98a3, 0.55);
  }
}

function addTopHinges(group: THREE.Group, face: Rect, z: number): void {
  const y = face.y + 16;
  const positions = [face.x + face.w * 0.28, face.x + face.w * 0.72];
  for (const x of positions) {
    addHingeCylinder(group, x, y, 7, Math.min(70, face.w * 0.18), z + 8, "horizontal");
    addHardwareBox(group, { x: x - 24, y: y - 8, w: 48, h: 16 }, 5, z + 2, 0x8f98a3, 0.55);
  }
}

function addRestrictorStay(group: THREE.Group, face: Rect, side: "left" | "right", z: number): void {
  const x1 = side === "left" ? face.x + 30 : face.x + face.w - 30;
  const x2 = side === "left" ? face.x + face.w * 0.28 : face.x + face.w * 0.72;
  const y1 = face.y + face.h * 0.22;
  const y2 = face.y + face.h * 0.43;
  addRod(group, x1, y1, x2, y2, z + 9, 6, 0x7b8490);
}

function addTiltTurnMarker(group: THREE.Group, face: Rect, z: number): void {
  addHardwareBox(group, { x: face.x + 24, y: face.y + face.h - 26, w: face.w - 48, h: 8 }, 5, z + 3, 0x7b8490, 0.55);
}

function addRollers(group: THREE.Group, face: Rect, z: number): void {
  const y = face.y + face.h - 18;
  for (const x of [face.x + face.w * 0.28, face.x + face.w * 0.72]) {
    addRoundHardware(group, x, y, 10, 7, z + 7, 0x6f7782);
  }
}

function addSlidingTrack(group: THREE.Group, outer: Rect): void {
  const z = FRAME_DEPTH / 2 + 10;
  const y = outer.y + outer.h - 34;
  addHardwareBox(group, { x: outer.x + 42, y, w: outer.w - 84, h: 8 }, 10, z, 0x77818d, 0.8);
  addHardwareBox(group, { x: outer.x + 42, y: y + 18, w: outer.w - 84, h: 8 }, 10, z, 0x77818d, 0.8);
}

function latchHandleRect(face: Rect, side: "left" | "right", door: boolean): Rect {
  const w = door ? 24 : 20;
  const h = door ? 96 : 72;
  const margin = door ? 44 : 34;
  return {
    x: side === "left" ? face.x + margin : face.x + face.w - margin - w,
    y: face.y + face.h * (door ? 0.46 : 0.48) - h / 2,
    w,
    h,
  };
}

function addHardwareBox(group: THREE.Group, r: Rect, depth: number, z: number, color: number, opacity: number): void {
  const geo = new THREE.BoxGeometry(Math.max(1, r.w), Math.max(1, r.h), depth);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.36,
    metalness: 0.62,
    transparent: opacity < 1,
    opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r.x + r.w / 2, r.y + r.h / 2, z);
  mesh.castShadow = true;
  group.add(mesh);
}

function addRoundHardware(group: THREE.Group, x: number, y: number, radius: number, depth: number, z: number, color: number): void {
  const geo = new THREE.CylinderGeometry(radius, radius, depth, 28);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.68 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
}

function addHingeCylinder(
  group: THREE.Group,
  x: number,
  y: number,
  radius: number,
  length: number,
  z: number,
  orientation: "vertical" | "horizontal",
): void {
  const geo = new THREE.CylinderGeometry(radius, radius, Math.max(1, length), 24);
  const mat = new THREE.MeshStandardMaterial({ color: METAL_HEX, roughness: 0.38, metalness: 0.64 });
  const mesh = new THREE.Mesh(geo, mat);
  if (orientation === "horizontal") mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
}

function addRod(group: THREE.Group, x1: number, y1: number, x2: number, y2: number, z: number, thickness: number, color: number): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len <= 0.5) return;
  const r = { x: (x1 + x2) / 2 - len / 2, y: (y1 + y2) / 2 - thickness / 2, w: len, h: thickness };
  const geo = new THREE.BoxGeometry(r.w, r.h, 5);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.58 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r.x + r.w / 2, r.y + r.h / 2, z);
  mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  mesh.castShadow = true;
  group.add(mesh);
}

function addGlassReflection(group: THREE.Group, r: Rect, z: number): void {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const [x, y, w] of [
    [r.x + r.w * 0.34, r.y + r.h * 0.3, r.w * 0.78],
    [r.x + r.w * 0.58, r.y + r.h * 0.64, r.w * 0.5],
  ] as const) {
    const geo = new THREE.PlaneGeometry(Math.max(24, w), Math.max(8, r.h * 0.018));
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(x, y, z);
    mesh.rotation.z = -0.48;
    group.add(mesh);
  }
}

function addRectLine(group: THREE.Group, r: Rect, z: number, color: number, opacity: number): void {
  const pts = [
    new THREE.Vector3(r.x, r.y, z),
    new THREE.Vector3(r.x + r.w, r.y, z),
    new THREE.Vector3(r.x + r.w, r.y + r.h, z),
    new THREE.Vector3(r.x, r.y + r.h, z),
    new THREE.Vector3(r.x, r.y, z),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  group.add(new THREE.Line(geo, mat));
}

function insetRect(r: Rect, inset: number): Rect {
  return {
    x: r.x + inset,
    y: r.y + inset,
    w: Math.max(1, r.w - inset * 2),
    h: Math.max(1, r.h - inset * 2),
  };
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
