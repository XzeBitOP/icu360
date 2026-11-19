import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type StageOptions = {
  camera: [number, number, number];
  target: [number, number, number];
  fov?: number;
  /** Device-pixel-ratio cap (mid-range phones: 1.5). */
  maxDpr?: number;
  /** Low-end devices: no MSAA, DPR 1. */
  low?: boolean;
  minDistance?: number;
  maxDistance?: number;
};

export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  labels: CSS2DRenderer;
  domElement: HTMLCanvasElement;
  /** Register a per-frame callback; returns an unsubscribe function. */
  onFrame: (cb: (dtMs: number, nowMs: number) => void) => () => void;
  render: () => void;
  resize: () => void;
  dispose: () => void;
};

/** WebGL2 availability + a coarse low-end heuristic (few cores, little memory, software renderer). */
export function webglSupport(): { ok: boolean; low: boolean } {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, low: true };
    const nav = navigator as Navigator & { deviceMemory?: number };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const rend = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    const soft = /swiftshader|llvmpipe|software/i.test(rend);
    const low = (nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) <= 2;
    return { ok: true, low: low || (soft && false) };
  } catch {
    return { ok: false, low: true };
  }
}

export function createStage(container: HTMLElement, o: StageOptions): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: !o.low, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.low ? 1 : o.maxDpr ?? 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const dom = renderer.domElement;
  dom.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
  dom.tabIndex = 0;
  container.appendChild(dom);

  const labels = new CSS2DRenderer();
  labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();

  const key = new THREE.DirectionalLight(0xfff1e6, 2.4); key.position.set(2.5, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa7ff, 1.6); rim.position.set(-4, 1.5, -3); scene.add(rim);
  const fill = new THREE.HemisphereLight(0xdfe8ff, 0x2a1020, 0.55); scene.add(fill);

  const camera = new THREE.PerspectiveCamera(o.fov ?? 34, 1, 0.1, 100);
  camera.position.set(...o.camera);
  const controls = new OrbitControls(camera, dom);
  controls.target.set(...o.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = o.minDistance ?? 3;
  controls.maxDistance = o.maxDistance ?? 14;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.update();

  const cbs = new Set<(dt: number, now: number) => void>();
  let last = performance.now();
  let raf = 0;
  let disposed = false;
  let visible = true;
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; }) : null;
  io?.observe(container);

  const resize = () => {
    const w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const render = () => { controls.update(); renderer.render(scene, camera); labels.render(scene, camera); };
  const loop = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) { last = now; return; }
    const dt = now - last; last = now;
    for (const cb of cbs) cb(dt, now);
    render();
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer, scene, camera, controls, labels, domElement: dom, render, resize,
    onFrame: (cb) => { cbs.add(cb); return () => cbs.delete(cb); },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io?.disconnect(); ro.disconnect();
      controls.dispose();
      scene.traverse((ob) => { const m = ob as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); });
      env.dispose();
      renderer.dispose();
      dom.remove(); labels.domElement.remove();
    },
  };
}
