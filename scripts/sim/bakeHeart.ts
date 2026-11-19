import { HEART_BOUNDS, HEART_REGION_NAMES, RIGHT_SIDE, heartField, regionAt, surfaceKind, type HeartRegion } from "../../src/components/sim3d/heart/anatomy.ts";
import type { V3 } from "../../src/components/sim3d/sdf.ts";
import type { BakeSpec } from "../bake-sim-meshes.ts";

const mix = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const noise = (p: V3, f: number) => {
  const x = p[0] * f, y = p[1] * f, z = p[2] * f;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sm = (t: number) => t * t * (3 - 2 * t);
  let acc = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++)
    acc += hash(xi + dx, yi + dy, zi + dz) * (dx ? sm(fx) : 1 - sm(fx)) * (dy ? sm(fy) : 1 - sm(fy)) * (dz ? sm(fz) : 1 - sm(fz));
  return acc;
};

const VENOUS = [37, 99, 235], ARTERIAL = [200, 30, 50];
const MUSCLE = [92, 20, 32], PINK = [150, 70, 86], VESSEL_CUT = [176, 92, 96];

export function bakeHeart(cell: number): BakeSpec {
  const h = Number.isFinite(cell) && cell > 0 ? cell : 0.03;
  return {
    out: "public/sim/heart.bin",
    field: heartField,
    lo: HEART_BOUNDS.lo, hi: HEART_BOUNDS.hi, h,
    region: (p) => regionAt(p),
    names: HEART_REGION_NAMES,
    relax: 3,
    colour: (p, r) => {
      const region = r as HeartRegion;
      const kind = surfaceKind(p, h);
      const right = RIGHT_SIDE[region];
      const vessel = region === "SVC" || region === "IVC" || region === "PT" || region === "AO" || region === "PV";
      const tint = right ? VENOUS : ARTERIAL;
      let c: [number, number, number];
      if (kind === 2) c = vessel ? mix(VESSEL_CUT, tint, 0.3) : region === "RA" || region === "LA" ? mix([150, 70, 82], tint, 0.25) : mix(MUSCLE, tint, right ? 0.22 : 0.1);
      else if (kind === 1) c = vessel ? mix([120, 50, 66], tint, right ? 0.7 : 0.62) : mix([120, 50, 66], tint, right ? 0.68 : 0.6);
      else c = vessel ? mix(PINK, tint, right ? 0.9 : 0.86) : region === "SEPTUM" ? mix(PINK, ARTERIAL, 0.7) : mix(PINK, tint, right ? 0.88 : 0.84);
      const n = 0.88 + 0.2 * noise(p, 3.2) + 0.08 * noise(p, 9);
      return [Math.min(255, c[0] * n), Math.min(255, c[1] * n), Math.min(255, c[2] * n)];
    },
  };
}
