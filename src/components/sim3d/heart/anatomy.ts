import { cutZ, ridge, ellipsoid, makeTube, roundCone, sdTube, smin, type TubePath, type V3 } from "../sdf.ts";

/**
 * Procedural, schematic cutaway heart (front view: patient's left is screen-right). The anterior half (z > ZC) is removed along a
 * coronal plane. Everything is defined as signed-distance fields, meshed offline by scripts/bake-sim-meshes.ts (surface nets), and
 * the same functions are reused at runtime to snap conduction tracts and valve rings onto the lumen. Units are arbitrary (≈ 3 cm).
 */
export const ZC = 0;

export const WALL = { lv: 0.42, lvApex: 0.22, rv: 0.15, atria: 0.09, vessel: 0.09 };

const v = (x: number, y: number, z: number): V3 => [x, y, z];

// ---- chamber shapes --------------------------------------------------------------------------------------------------------
const LV = { a: v(0.6, 0.02, -0.12), b: v(1.1, -1.6, -0.12), r1: 0.6, r2: 0.2 };
const RV = { a: v(-0.78, 0.3, -0.14), b: v(-0.38, -1.5, -0.12), r1: 0.62, r2: 0.22 };
const RA = { c: v(-1.5, 1.02, -0.22), r: v(0.56, 0.64, 0.54) };
const BRIDGE = { c: v(-0.35, 1.45, -0.8), r: v(0.85, 0.4, 0.3) };
const LA = { c: v(0.92, 1.28, -0.4), r: v(0.64, 0.48, 0.54) };

// ---- vessels and valve channels --------------------------------------------------------------------------------------------
const tubes = {
  svc: makeTube([v(-1.5, 3.2, -0.22), v(-1.5, 2.4, -0.22), v(-1.45, 1.5, -0.22)], [0.225, 0.225, 0.234]),
  ivc: makeTube([v(-1.95, -1.15, -0.3), v(-1.8, -0.4, -0.28), v(-1.62, 0.4, -0.24)], [0.252, 0.252, 0.252]),
  pa: makeTube([v(-0.62, 0.45, -0.12), v(-0.55, 1.0, -0.12), v(-0.55, 1.75, -0.12), v(-0.5, 2.1, -0.14)], [0.27, 0.243, 0.234, 0.234]),
  rpa: makeTube([v(-0.5, 2.05, -0.16), v(-0.9, 2.28, -0.4), v(-1.5, 2.3, -0.7)], [0.2, 0.17, 0.15]),
  lpa: makeTube([v(-0.45, 2.05, -0.2), v(0.1, 2.28, -0.6), v(0.85, 2.15, -0.78), v(1.6, 1.95, -0.9)], [0.2, 0.17, 0.16, 0.15]),
  ao: makeTube([v(0.3, 0.05, -0.12), v(0.22, 0.85, -0.12), v(0.2, 1.7, -0.14), v(0.42, 2.38, -0.2), v(0.95, 2.62, -0.28), v(1.45, 2.32, -0.4), v(1.62, 1.75, -0.5)], [0.297, 0.297, 0.252, 0.243, 0.234, 0.234, 0.234]),
  brachio: makeTube([v(0.52, 2.5, -0.2), v(0.42, 3.0, -0.2), v(0.2, 3.55, -0.2)], [0.17, 0.16, 0.15]),
  carotid: makeTube([v(0.95, 2.6, -0.28), v(1.0, 3.1, -0.28), v(1.02, 3.6, -0.28)], [0.12, 0.12, 0.11]),
  subclavian: makeTube([v(1.3, 2.5, -0.35), v(1.58, 3.0, -0.35), v(1.95, 3.45, -0.35)], [0.14, 0.14, 0.13]),
  tricCh: makeTube([v(-1.4, 0.65, -0.16), v(-1.15, 0.12, -0.14), v(-0.98, -0.42, -0.12)], [0.34, 0.34, 0.34]),
  mitCh: makeTube([v(1.0, 0.95, -0.3), v(0.98, 0.4, -0.2), v(0.9, -0.2, -0.14)], [0.31, 0.31, 0.31]),
  pvR1: makeTube([v(0.4, 1.4, -0.6), v(-0.4, 1.5, -0.95), v(-1.1, 1.55, -1.1)], [0.15, 0.15, 0.15]),
  pvR2: makeTube([v(0.4, 1.05, -0.6), v(-0.4, 1.0, -0.98), v(-1.1, 0.95, -1.1)], [0.15, 0.15, 0.15]),
  pvL1: makeTube([v(1.4, 1.5, -0.5), v(1.9, 1.7, -0.7), v(2.35, 1.85, -0.8)], [0.15, 0.15, 0.15]),
  pvL2: makeTube([v(1.45, 1.05, -0.5), v(1.95, 1.0, -0.7), v(2.4, 0.9, -0.82)], [0.15, 0.15, 0.15]),
};
export const TUBES = tubes;

const lumenEnds: (keyof typeof tubes)[] = [];
void lumenEnds;

// ---- distance fields -------------------------------------------------------------------------------------------------------
export type PartId = "LV" | "RV" | "RA" | "LA" | "SVC" | "IVC" | "PT" | "AO" | "PV" | "VALVE_R" | "VALVE_L";

const outerLV = (p: V3) => roundCone(p, LV.a, LV.b, LV.r1 + WALL.lv, LV.r2 + WALL.lvApex);
const outerRV = (p: V3) => roundCone(p, RV.a, RV.b, RV.r1 + WALL.rv, RV.r2 + WALL.rv);
const outerRA = (p: V3) => ellipsoid(p, RA.c, [RA.r[0] + WALL.atria, RA.r[1] + WALL.atria, RA.r[2] + WALL.atria]);
const outerLA = (p: V3) => ellipsoid(p, LA.c, [LA.r[0] + WALL.atria, LA.r[1] + WALL.atria, LA.r[2] + WALL.atria]);
const g = WALL.vessel;
const outerT = (t: TubePath) => (p: V3) => sdTube(p, t, g);

const lumenLV = (p: V3) => roundCone(p, LV.a, LV.b, LV.r1, LV.r2) + 0.012 * ridge(p, 7);
const lumenRV0 = (p: V3) => roundCone(p, RV.a, RV.b, RV.r1, RV.r2) + 0.03 * ridge(p, 8.5);
const lumenRA = (p: V3) => ellipsoid(p, RA.c, RA.r);
const lumenLA = (p: V3) => ellipsoid(p, LA.c, LA.r);

/** Outer solids by part (negative inside) used for labelling and for the union. */
export function outerParts(p: V3): Record<PartId, number> {
  return {
    LV: outerLV(p), RV: outerRV(p), RA: outerRA(p), LA: outerLA(p),
    SVC: outerT(tubes.svc)(p), IVC: outerT(tubes.ivc)(p),
    PT: Math.min(outerT(tubes.pa)(p), outerT(tubes.rpa)(p), outerT(tubes.lpa)(p)),
    AO: Math.min(outerT(tubes.ao)(p), outerT(tubes.brachio)(p), outerT(tubes.carotid)(p), outerT(tubes.subclavian)(p)),
    PV: Math.min(outerT(tubes.pvR1)(p), outerT(tubes.pvR2)(p), outerT(tubes.pvL1)(p), outerT(tubes.pvL2)(p)),
    VALVE_R: outerT(tubes.tricCh)(p), VALVE_L: outerT(tubes.mitCh)(p),
  };
}

const extend = (t: TubePath, pad: number): TubePath => t; // lumen runs the full path; open ends come from lumen being longer than outer (see below)
void extend;

export function solidOuter(p: V3): number {
  const o = outerParts(p);
  const bridge = ellipsoid(p, BRIDGE.c, BRIDGE.r);
  const hearts = smin(smin(o.LV, o.RV, 0.18), smin(smin(o.RA, o.LA, 0.12), bridge, 0.2), 0.1);
  const vessels = Math.min(o.SVC, o.IVC, o.PT, o.AO, o.PV);
  const valves = Math.min(o.VALVE_R, o.VALVE_L);
  return smin(smin(hearts, vessels, 0.12), valves, 0.08);
}

const sdTubeOpen = (t: TubePath) => (p: V3) => {
  // lumen of an open-ended vessel: the tube plus a collinear extension past both ends so the end caps are cut through
  const a = t.pts[0], b = t.pts[t.pts.length - 1];
  const a2 = t.pts[1], b2 = t.pts[t.pts.length - 2];
  const ext = (q: V3, q2: V3, r: number): V3 => { const dx = q[0] - q2[0], dy = q[1] - q2[1], dz = q[2] - q2[2]; const l = Math.hypot(dx, dy, dz) || 1; return [q[0] + (dx / l) * (r + 0.25), q[1] + (dy / l) * (r + 0.25), q[2] + (dz / l) * (r + 0.25)]; };
  const ea = ext(a, a2, t.radii[0]), eb = ext(b, b2, t.radii[t.radii.length - 1]);
  return Math.min(sdTube(p, t, 0), roundCone(p, ea, a, t.radii[0], t.radii[0]), roundCone(p, b, eb, t.radii[t.radii.length - 1], t.radii[t.radii.length - 1]));
};

const L = {
  svc: sdTubeOpen(tubes.svc), ivc: sdTubeOpen(tubes.ivc), pa: (p: V3) => sdTube(p, tubes.pa, 0),
  rpa: sdTubeOpen(tubes.rpa), lpa: sdTubeOpen(tubes.lpa), ao: (p: V3) => sdTube(p, tubes.ao, 0),
  brachio: sdTubeOpen(tubes.brachio), carotid: sdTubeOpen(tubes.carotid), subclavian: sdTubeOpen(tubes.subclavian),
  tric: (p: V3) => sdTube(p, tubes.tricCh, 0), mit: (p: V3) => sdTube(p, tubes.mitCh, 0),
  pvR1: sdTubeOpen(tubes.pvR1), pvR2: sdTubeOpen(tubes.pvR2), pvL1: sdTubeOpen(tubes.pvL1), pvL2: sdTubeOpen(tubes.pvL2),
};

/** Left-heart lumen (LA, LV, mitral channel, aorta and branches, pulmonary veins). */
export function lumenLeft(p: V3): number {
  let d = smin(lumenLV(p), lumenLA(p), 0.06);
  d = Math.min(d, L.mit(p), L.ao(p), L.brachio(p), L.carotid(p), L.subclavian(p), L.pvR1(p), L.pvR2(p), L.pvL1(p), L.pvL2(p));
  return d;
}
/** Right-heart lumen (RA, RV, tricuspid channel, SVC, IVC, pulmonary trunk and branches); septum protected by the left heart. */
export function lumenRight(p: V3): number {
  let d = smin(lumenRV0(p), lumenRA(p), 0.06);
  d = Math.min(d, L.tric(p), L.svc(p), L.ivc(p), L.pa(p), L.rpa(p), L.lpa(p));
  const leftOuter = Math.min(outerLV(p), outerLA(p), outerT(tubes.ao)(p), outerT(tubes.pvR1)(p), outerT(tubes.pvR2)(p));
  return Math.max(d, -leftOuter + 0.02);
}
export const lumen = (p: V3) => Math.min(lumenLeft(p), lumenRight(p));

/** Full wall field (solid minus lumen, anterior half removed). */
export function heartField(p: V3): number {
  return cutZ(Math.max(solidOuter(p), -lumen(p)), p[2], ZC);
}

export type HeartRegion = "LV" | "RV" | "RA" | "LA" | "SEPTUM" | "SVC" | "IVC" | "PT" | "AO" | "PV";
export const HEART_REGION_NAMES: Record<HeartRegion, string> = {
  LV: "LeftVentricle", RV: "RightVentricle", RA: "RightAtrium", LA: "LeftAtrium", SEPTUM: "InterventricularSeptum",
  SVC: "SuperiorVenaCava", IVC: "InferiorVenaCava", PT: "PulmonaryTrunk", AO: "AorticArch", PV: "PulmonaryVeins",
};

/** Which named structure a surface point belongs to. */
export function regionAt(p: V3): HeartRegion {
  const o = outerParts(p);
  let best: PartId = "LV", bd = Infinity;
  for (const k of Object.keys(o) as PartId[]) {
    const bias = k === "VALVE_R" ? 0.06 : k === "VALVE_L" ? 0.06 : k === "RV" ? 0.03 : 0;
    const d = o[k] + bias;
    if (d < bd) { bd = d; best = k; }
  }
  if (best === "VALVE_R") return o.RA < o.RV ? "RA" : "RV";
  if (best === "VALVE_L") return o.LA < o.LV ? "LA" : "LV";
  if (best === "LV" && lumenRV0(p) < 0.3 && p[1] < 0.5) return "SEPTUM";
  return best as HeartRegion;
}

/** 0 = outer (epi/adventitia) surface, 1 = lumen (endocardium), 2 = cut face. */
export function surfaceKind(p: V3, h: number): 0 | 1 | 2 {
  if (Math.abs(p[2] - ZC) < h * 0.7) return 2;
  return Math.abs(lumen(p)) < h * 0.9 ? 1 : 0;
}

export const RIGHT_SIDE: Record<HeartRegion, boolean> = { LV: false, RV: true, RA: true, LA: false, SEPTUM: false, SVC: true, IVC: true, PT: true, AO: false, PV: false };

export const HEART_BOUNDS = { lo: [-2.4, -2.5, -1.4] as V3, hi: [2.6, 3.8, ZC + 0.12] as V3 };
export const lumenSurfaceSnap = lumen;

// Chamber centres/radii used by the runtime deformation (contraction) field.
export const CHAMBERS = {
  ra: { c: RA.c, r: [RA.r[0] + 0.25, RA.r[1] + 0.25, RA.r[2] + 0.3] as V3 },
  la: { c: LA.c, r: [LA.r[0] + 0.25, LA.r[1] + 0.25, LA.r[2] + 0.3] as V3 },
  lv: { c: [0.82, -0.75, -0.12] as V3, r: [1.05, 1.5, 1.0] as V3 },
  rv: { c: [-0.7, -0.6, -0.12] as V3, r: [0.85, 1.25, 0.8] as V3 },
};
export const HEART_LAYOUT = { LV, RV, RA, LA };

/** Outer surface of the whole cutaway heart (used to put overlays on the exterior). */
export const solid = (p: V3) => cutZ(solidOuter(p), p[2], ZC);
export const OUTER_LV = outerLV;
export const LUMEN_LV = lumenLV;
export const LUMEN_RV = lumenRV0;
export const LUMEN_RA = lumenRA;
export const LUMEN_LA = lumenLA;
