/**
 * Tiny signed-distance-field toolkit used to SCULPT the organ meshes procedurally (negative = inside).
 * The heavy meshing (surface nets) runs in scripts/bake-sim-meshes.ts; the runtime reuses these functions only for cheap point queries
 * (snapping conduction tracts and valve rings onto the lumen surface). Pure maths: no three.js, no DOM.
 */
export type V3 = [number, number, number];

export const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
export const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/** Approximate ellipsoid distance (Inigo Quilez), optionally rotated about Z (xy-plane tilt). */
export function ellipsoid(p: V3, c: V3, r: V3, rotZ = 0): number {
  let x = p[0] - c[0], y = p[1] - c[1];
  const z = p[2] - c[2];
  if (rotZ) {
    const cs = Math.cos(rotZ), sn = Math.sin(rotZ);
    const nx = cs * x + sn * y, ny = -sn * x + cs * y;
    x = nx; y = ny;
  }
  const k0 = len3(x / r[0], y / r[1], z / r[2]);
  const k1 = len3(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** Exact round cone (capsule with two radii), Inigo Quilez. */
export function roundCone(p: V3, a: V3, b: V3, r1: number, r2: number): number {
  const ba0 = b[0] - a[0], ba1 = b[1] - a[1], ba2 = b[2] - a[2];
  const l2 = ba0 * ba0 + ba1 * ba1 + ba2 * ba2;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pa0 = p[0] - a[0], pa1 = p[1] - a[1], pa2 = p[2] - a[2];
  const y = pa0 * ba0 + pa1 * ba1 + pa2 * ba2;
  const z = y - l2;
  const x0 = pa0 * l2 - ba0 * y, x1 = pa1 * l2 - ba1 * y, x2 = pa2 * l2 - ba2 * y;
  const x2s = x0 * x0 + x1 * x1 + x2 * x2;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2s;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2s + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2s + y2) * il2 - r1;
  return (Math.sqrt(x2s * a2 * il2) + y * rr) * il2 - r1;
}

export type TubePath = { pts: V3[]; radii: number[]; bounds: { lo: V3; hi: V3 } };

/** Catmull-Rom resample of control points (centripetal not needed at this scale). */
export function sampleCurve(ctrl: V3[], perSeg = 5): V3[] {
  const out: V3[] = [];
  const n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, n - 1)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg, t2 = t * t, t3 = t2 * t;
      const q = [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)) as number[];
      out.push([q[0], q[1], q[2]]);
    }
  }
  out.push(ctrl[n - 1]);
  return out;
}

/** Variable-radius tube along a smoothed polyline; `r` is interpolated along the control points. */
export function makeTube(ctrl: V3[], r: number[], perSeg = 5): TubePath {
  const pts = sampleCurve(ctrl, perSeg);
  const radii = pts.map((_, i) => {
    const u = (i / (pts.length - 1)) * (r.length - 1);
    const i0 = Math.min(Math.floor(u), r.length - 2);
    return r[i0] + (r[i0 + 1] - r[i0]) * (u - i0);
  });
  const rmax = Math.max(...radii) + 0.01;
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - rmax); hi[k] = Math.max(hi[k], p[k] + rmax); }
  return { pts, radii, bounds: { lo, hi } };
}

/** Distance to a tube; `grow` inflates the radius (wall thickness); bounding-box early-out keeps big fields cheap. */
export function sdTube(p: V3, t: TubePath, grow = 0): number {
  const { lo, hi } = t.bounds;
  const m = grow + 0.2;
  const dx = Math.max(lo[0] - p[0], 0, p[0] - hi[0]), dy = Math.max(lo[1] - p[1], 0, p[1] - hi[1]), dz = Math.max(lo[2] - p[2], 0, p[2] - hi[2]);
  const bd = len3(dx, dy, dz);
  if (bd > m + 0.4) return bd - m;
  let d = Infinity;
  for (let i = 0; i < t.pts.length - 1; i++) d = Math.min(d, roundCone(p, t.pts[i], t.pts[i + 1], t.radii[i] + grow, t.radii[i + 1] + grow));
  return d;
}

/** Plane cut keeping z <= zc (the anterior half z > zc is removed). */
export const cutZ = (d: number, z: number, zc: number) => Math.max(d, z - zc);

export function gradient(f: (p: V3) => number, p: V3, h = 0.01): V3 {
  const gx = f([p[0] + h, p[1], p[2]]) - f([p[0] - h, p[1], p[2]]);
  const gy = f([p[0], p[1] + h, p[2]]) - f([p[0], p[1] - h, p[2]]);
  const gz = f([p[0], p[1], p[2] + h]) - f([p[0], p[1], p[2] - h]);
  const l = len3(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

/** Move `p` onto the zero level set of f (plus `offset` along the outward normal). */
export function snapToSurface(f: (p: V3) => number, p: V3, offset = 0, iters = 24): V3 {
  const q: V3 = [p[0], p[1], p[2]];
  for (let i = 0; i < iters; i++) {
    const d = f(q) - offset;
    if (Math.abs(d) < 1e-4) break;
    const g = gradient(f, q);
    q[0] -= g[0] * d * 0.9; q[1] -= g[1] * d * 0.9; q[2] -= g[2] * d * 0.9;
  }
  return q;
}

const h3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
/** Smooth 3-D value noise in 0..1. */
export function noise3(p: V3, f: number): number {
  const x = p[0] * f, y = p[1] * f, z = p[2] * f;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const ux = sm(fx), uy = sm(fy), uz = sm(fz);
  let acc = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) acc += h3(xi + dx, yi + dy, zi + dz) * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  return acc;
}
/** Ridged noise in -1..1 (sharp valleys, rounded crests): used for trabeculae carneae and alveolar texture. */
export const ridge = (p: V3, f: number) => 1 - 2 * Math.abs(2 * noise3(p, f) - 1);
