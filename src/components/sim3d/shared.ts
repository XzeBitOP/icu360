import * as THREE from "three";

export type PartInfo = { id: string; name: string; physiology: string };

/** Glow material for conduction tracts: idle glow + a travelling wavefront + a decaying trail, driven by one scalar per tract. */
export const TRACT_VERT = /* glsl */ `
attribute float aS;
varying float vS;
varying vec3 vN;
vec3 hdef(vec3 p);
void main(){
  vS = aS;
  vN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.xyz = hdef(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const TRACT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uProg;   // 0 idle, 0..1 wavefront position, 1..2 trailing glow
uniform float uBase;
uniform float uBoost;  // hover / selection
uniform float uWidth;
varying float vS;
varying vec3 vN;
void main(){
  float head = 0.0;
  float trail = 0.0;
  if (uProg > 0.0 && uProg < 1.0) { float d = (vS - uProg) / uWidth; head = exp(-d * d); trail = vS < uProg ? 0.55 * exp(-(uProg - vS) * 5.0) : 0.0; }
  else if (uProg >= 1.0) { trail = 0.75 * exp(-(uProg - 1.0) * 3.2); }
  float g = uBase + head + trail + uBoost;
  vec3 col = uColor * (0.35 + 1.5 * g) + vec3(1.0, 0.95, 0.8) * head * 0.9;
  float rim = 0.6 + 0.4 * abs(vN.z);
  gl_FragColor = vec4(col * rim, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function tubeGeometry(points: THREE.Vector3[], radius: number, sValues: number[], radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const segs = Math.max(8, points.length * 2);
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const n = g.attributes.position.count;
  const s = new Float32Array(n);
  const ring = radial + 1;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / ring);
    const t = row / segs;
    const f = t * (sValues.length - 1);
    const i0 = Math.min(Math.floor(f), sValues.length - 2);
    s[i] = sValues.length > 1 ? sValues[i0] + (sValues[i0 + 1] - sValues[i0]) * (f - i0) : t;
  }
  g.setAttribute("aS", new THREE.BufferAttribute(s, 1));
  return g;
}

/** Merge many thin tubes (branching networks) into one geometry with an `aS` attribute. */
export function mergedTubes(branches: { pts: [number, number, number][]; s: number[] }[], radius: number, radial = 4): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], sv: number[] = [], idx: number[] = [];
  let base = 0;
  for (const b of branches) {
    if (b.pts.length < 2) continue;
    const pts = b.pts.map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const segs = Math.max(2, pts.length * 2 - 2);
    const g = new THREE.TubeGeometry(curve, segs, radius, radial, false);
    const p = g.attributes.position, nn = g.attributes.normal, ix = g.index!;
    const ring = radial + 1;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      const t = Math.floor(i / ring) / segs;
      const f = t * (b.s.length - 1);
      const i0 = Math.min(Math.floor(f), b.s.length - 2);
      sv.push(b.s[i0] + (b.s[i0 + 1] - b.s[i0]) * (f - i0));
    }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("aS", new THREE.Float32BufferAttribute(sv, 1));
  out.setIndex(idx);
  return out;
}

/** Floating tooltip + pins. */
export function makeTooltip(container: HTMLElement) {
  const el = document.createElement("div");
  el.className = "sim3d-tip";
  el.setAttribute("role", "tooltip");
  el.style.display = "none";
  container.appendChild(el);
  return {
    show(info: PartInfo, x: number, y: number) {
      el.innerHTML = "";
      const h = document.createElement("b"); h.textContent = info.name;
      const p = document.createElement("span"); p.textContent = info.physiology;
      el.append(h, p);
      el.style.display = "block";
      const w = container.clientWidth, hgt = container.clientHeight;
      const bw = el.offsetWidth, bh = el.offsetHeight;
      let left = x + 14, top = y + 14;
      if (left + bw > w - 6) left = Math.max(6, x - bw - 14);
      if (top + bh > hgt - 6) top = Math.max(6, y - bh - 14);
      el.style.left = `${left}px`; el.style.top = `${top}px`;
    },
    hide() { el.style.display = "none"; },
    el,
  };
}

export function makePin(label: string, dx: number, dy: number, kind: string, testId?: string): HTMLElement {
  const root = document.createElement("div");
  root.className = `sim3d-pin k-${kind}`;
  if (testId) root.dataset.testid = testId;
  const len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dot = document.createElement("i");
  const line = document.createElement("b");
  line.style.width = `${len}px`; line.style.transform = `rotate(${ang}deg)`;
  const lab = document.createElement("span");
  lab.textContent = label;
  lab.style.transform = `translate(${dx}px, ${dy}px) translate(${dx < 0 ? "-100%" : "0"}, -50%)`;
  root.append(line, dot, lab);
  return root;
}
