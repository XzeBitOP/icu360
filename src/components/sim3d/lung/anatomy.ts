import { ellipsoid, noise3, smax, smin, type V3 } from "../sdf.ts";

/**
 * Procedural, schematic lung anatomy (front view: patient's right is screen-left). Five lobes, each its own signed-distance field so
 * the fissures appear naturally as grooves between adjoining lobes. Pure maths: shared by the offline bake and the runtime (airway
 * generation keeps branches inside their lobe).
 */

export type LobeId = "RUL" | "RML" | "RLL" | "LUL" | "LLL";
export const LOBES: LobeId[] = ["RUL", "RML", "RLL", "LUL", "LLL"];
export const LOBE_NAMES: Record<LobeId, string> = { RUL: "RightUpperLobe", RML: "RightMiddleLobe", RLL: "RightLowerLobe", LUL: "LeftUpperLobe", LLL: "LeftLowerLobe" };
export const LOBE_TITLES: Record<LobeId, string> = { RUL: "Right upper lobe", RML: "Right middle lobe", RLL: "Right lower lobe", LUL: "Left upper lobe", LLL: "Left lower lobe" };

const GROOVE = 0.045;

/** Signed distance to the plane  n·p = d  (n need not be unit). */
const plane = (p: V3, n: V3, d: number) => (n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d) / Math.hypot(...n);

function rightLung(p: V3): number {
  let d = smin(ellipsoid(p, [-1.72, 0.55, -0.02], [0.98, 1.62, 0.92]), ellipsoid(p, [-1.78, -0.85, -0.02], [1.2, 1.35, 1.02]), 0.6);
  d = smax(d, -ellipsoid(p, [0.35, -0.5, 0.55], [1.1, 1.5, 1.0]), 0.25); // heart bed (medial concavity)
  d = smax(d, -ellipsoid(p, [-1.5, -3.55, 0], [3.4, 1.5, 2.3]), 0.3); // diaphragm dome indents the base
  d = smax(d, -ellipsoid(p, [-0.3, 0.7, -0.15], [0.5, 0.45, 0.5]), 0.12); // hilum notch
  return d + 0.04 * (noise3(p, 2.6) - 0.5);
}
function leftLung(p: V3): number {
  let d = smin(ellipsoid(p, [1.66, 0.55, -0.02], [0.9, 1.62, 0.9]), ellipsoid(p, [1.72, -0.85, -0.02], [1.08, 1.35, 1.0]), 0.6);
  d = smax(d, -ellipsoid(p, [-0.15, -0.75, 0.6], [1.5, 1.5, 1.05]), 0.25); // heart bed
  d = smax(d, -ellipsoid(p, [0.35, -1.15, 0.85], [1.15, 0.9, 0.9]), 0.2); // cardiac notch (anterior, lingular region)
  d = smax(d, -ellipsoid(p, [1.5, -3.55, 0], [3.4, 1.5, 2.3]), 0.3);
  d = smax(d, -ellipsoid(p, [0.3, 0.7, -0.15], [0.5, 0.45, 0.5]), 0.12);
  return d + 0.04 * (noise3(p, 2.6) - 0.5);
}

// Oblique fissure: y + 0.95 z = d (rises towards the back); horizontal fissure (right only): y = -0.22 in front of the oblique.
const RIGHT_OBLIQUE = (p: V3) => plane(p, [0, 1, 0.95], -0.55); // >0 upper (RUL + RML), <0 lower (RLL)
const LEFT_OBLIQUE = (p: V3) => plane(p, [0, 1, 0.95], -0.5);
const RIGHT_HORIZ = (p: V3) => plane(p, [0, 1, 0.12], -0.15); // >0 RUL, <0 RML

export const lobeField: Record<LobeId, (p: V3) => number> = {
  RUL: (p) => smax(smax(rightLung(p), -RIGHT_OBLIQUE(p), 0.05), -RIGHT_HORIZ(p), 0.05) + GROOVE,
  RML: (p) => smax(smax(rightLung(p), -RIGHT_OBLIQUE(p), 0.05), RIGHT_HORIZ(p), 0.05) + GROOVE,
  RLL: (p) => smax(rightLung(p), RIGHT_OBLIQUE(p), 0.05) + GROOVE,
  LUL: (p) => smax(leftLung(p), -LEFT_OBLIQUE(p), 0.05) + GROOVE,
  LLL: (p) => smax(leftLung(p), LEFT_OBLIQUE(p), 0.05) + GROOVE,
};
export const lungField = (p: V3) => {
  let d = Infinity;
  for (const id of LOBES) d = Math.min(d, lobeField[id](p));
  return d;
};
export const lobeAt = (p: V3): LobeId => {
  let best: LobeId = "RUL", bd = Infinity;
  for (const id of LOBES) { const d = lobeField[id](p); if (d < bd) { bd = d; best = id; } }
  return best;
};
export const LUNG_BOUNDS = { lo: [-3.3, -2.7, -1.3] as V3, hi: [3.3, 2.8, 1.3] as V3 };

/** Where each lobar bronchus enters the lobe (the pivot for the lobe's expansion) and a point deep inside the lobe. */
export const LOBE_HILUM: Record<LobeId, V3> = {
  RUL: [-0.95, 0.85, -0.1], RML: [-0.85, -0.1, 0.05], RLL: [-0.9, -0.25, -0.3],
  LUL: [0.95, 0.85, -0.1], LLL: [1.0, -0.2, -0.3],
};
export const LOBE_CENTRE: Record<LobeId, V3> = {
  RUL: [-1.7, 1.25, -0.1], RML: [-1.9, -0.55, 0.45], RLL: [-1.85, -1.0, -0.45],
  LUL: [1.7, 1.2, -0.1], LLL: [1.8, -1.0, -0.4],
};
