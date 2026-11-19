import { type LobeId, LOBES, LOBE_CENTRE, LOBE_HILUM, lobeField } from "./anatomy.ts";
import type { V3 } from "../sdf.ts";

/** Deterministic procedural bronchial tree. Pure maths (no three.js) so it can be unit-tested: every branch stays inside its lobe. */

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export type Segment = { a: V3; b: V3; gen: number };
export type LobeAirways = { segments: Segment[]; terminals: V3[]; maxGen: number };

export const MAX_GEN = 6;
const INSIDE = -0.12; // keep segment ends this far inside the lobe surface

export function generateAirways(lobe: LobeId, seed = 7): LobeAirways {
  const field = lobeField[lobe];
  const rand = rng(seed + LOBES.indexOf(lobe) * 101);
  const centre = LOBE_CENTRE[lobe];
  const hilum = LOBE_HILUM[lobe];
  const segments: Segment[] = [];
  const terminals: V3[] = [];
  const first = norm(sub(centre, hilum));
  const grow = (pos: V3, dir: V3, len: number, gen: number) => {
    let end: V3 | null = null;
    let d = dir;
    for (let attempt = 0; attempt < 8 && !end; attempt++) {
      const cand = add(pos, d, len * (1 - attempt * 0.08));
      if (field(cand) < INSIDE && field(add(pos, d, len * 0.5)) < INSIDE) end = cand;
      else d = norm(add(norm(sub(centre, pos)), [rand() - 0.5, rand() - 0.5, rand() - 0.5], 0.9));
    }
    if (!end) { if (gen > 1) terminals.push(pos); return; }
    segments.push({ a: pos, b: end, gen });
    if (gen >= MAX_GEN) { terminals.push(end); return; }
    // two children, splayed about a random axis perpendicular to the parent, biased toward the lobe centre so the tree fills the volume
    const ref: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const axis = norm(cross(d, add(ref, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 0.8)));
    const side = norm(cross(axis, d));
    const spread = 0.42 + rand() * 0.2;
    const toC = norm(sub(centre, end));
    for (const sgn of [1, -1]) {
      const cd = norm(add(add(d, side, sgn * spread), toC, 0.28));
      grow(end, cd, len * (0.78 + rand() * 0.08), gen + 1);
    }
  };
  grow(hilum, first, 0.85, 0);
  return { segments, terminals, maxGen: MAX_GEN };
}

/** Radius by generation (lobar ≈ 0.1 → terminal ≈ 0.02). */
export const airwayRadius = (gen: number) => 0.12 * Math.pow(0.77, gen);

// ---- extrapulmonary airway (world space, not scaled with the lobes) ------------------------------------------------------------
export const TRACHEA = { top: [0, 3.15, -0.08] as V3, carina: [0, 0.95, -0.08] as V3, radius: 0.27 };
export const MAIN_BRONCHI: Record<"R" | "L", V3[]> = {
  R: [[0, 0.95, -0.08], [-0.28, 0.78, -0.1], [-0.55, 0.6, -0.1], [-0.82, 0.38, -0.12]],
  L: [[0, 0.95, -0.08], [0.35, 0.82, -0.1], [0.72, 0.62, -0.1], [1.1, 0.42, -0.12]],
};
/** Where each lobar bronchus leaves its main bronchus. */
export const LOBAR_ORIGIN: Record<LobeId, V3> = {
  RUL: [-0.55, 0.6, -0.1], RML: [-0.82, 0.38, -0.12], RLL: [-0.82, 0.38, -0.12],
  LUL: [0.72, 0.62, -0.1], LLL: [1.1, 0.42, -0.12],
};
export const ETT_PATH: V3[] = [[0, 1.9, -0.08], [0, 2.5, -0.08], [0, 3.2, -0.08], [0, 3.55, -0.05], [0.3, 3.95, 0.0], [1.0, 4.2, 0.08]];
