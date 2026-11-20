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

/** Lobar bronchus = gen 0, then three clean dichotomous splits (segmental → subsegmental → terminal): 15 tapering segments per lobe. */
export const MAX_GEN = 3;
const INSIDE = -0.07; // keep segment ends this far inside the lobe surface
const SPREAD = 0.55; // half-angle of each split (radians-ish, applied as a blend)

export function generateAirways(lobe: LobeId, seed = 7): LobeAirways {
  const field = lobeField[lobe];
  const rand = rng(seed + LOBES.indexOf(lobe) * 101);
  const centre = LOBE_CENTRE[lobe];
  const hilum = LOBE_HILUM[lobe];
  const segments: Segment[] = [];
  const ends: { p: V3; d: V3 }[] = [];
  const grow = (pos: V3, dir: V3, len: number, gen: number) => {
    // shorten until the branch end sits inside the lobe; give up on that branch only if it never fits
    let end: V3 | null = null;
    const toCentre = norm(sub(centre, pos));
    for (let k = 0; k < 14 && !end; k++) {
      const d2 = k === 0 ? dir : norm(add(dir, toCentre, k * 0.12)); // re-aim towards the lobe centre as it shortens
      const cand = add(pos, d2, len * (1 - k * 0.045));
      if (field(cand) < INSIDE && field(add(pos, d2, len * 0.5)) < INSIDE) { end = cand; dir = d2; }
    }
    if (!end && gen === 0) { end = add(pos, sub(centre, pos), 0.55); dir = norm(sub(centre, pos)); } // small lobes (RML): always seed the tree
    if (!end) return;
    segments.push({ a: pos, b: end, gen });
    if (gen >= MAX_GEN) { ends.push({ p: end, d: dir }); return; }
    // alternate the splitting plane every generation so the tree fills the lobe in 3D but stays tidy
    const ref: V3 = gen % 2 === 0 ? [0, 0, 1] : [1, 0, 0];
    const ref2: V3 = Math.abs(dir[0] * ref[0] + dir[1] * ref[1] + dir[2] * ref[2]) > 0.92 ? [0, 1, 0] : ref;
    const side = norm(cross(dir, ref2));
    const toC = norm(sub(centre, end));
    const spread = SPREAD * (1 - gen * 0.08);
    for (const sgn of [1, -1]) {
      const cd = norm(add(add(dir, side, sgn * spread), toC, 0.22 + (rand() - 0.5) * 0.06));
      grow(end, cd, len * 0.82, gen + 1);
    }
  };
  grow(hilum, norm(sub(centre, hilum)), 0.7, 0);
  // alveolar clusters sit around each terminal bronchiole (fan of 4 about the branch axis)
  const terminals: V3[] = [];
  for (const { p, d } of ends) {
    const ref: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(d, ref)), v = cross(d, u);
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + rand() * 0.4;
      const q = add(add(add(p, d, 0.16), u, Math.cos(ang) * 0.17), v, Math.sin(ang) * 0.17);
      terminals.push(field(q) < -0.04 ? q : add(p, d, 0.05));
    }
  }
  return { segments, terminals, maxGen: MAX_GEN };
}

/** Radius by generation (lobar ≈ 0.11 → terminal ≈ 0.05); each segment tapers into the next generation. */
export const airwayRadius = (gen: number) => 0.115 * Math.pow(0.72, gen);

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
