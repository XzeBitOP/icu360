import { gradient, sampleCurve, snapToSurface, type TubePath, type V3 } from "../sdf.ts";
import { LUMEN_LV, LUMEN_RV, OUTER_LV, TUBES, ZC, lumenLeft, lumenRight, solid } from "./anatomy.ts";

/**
 * Where the non-baked parts of the heart sit: valve rings, papillary muscles, conduction nodes and tracts.
 * Everything is derived from the same signed-distance functions that sculpt the walls, so overlays lie on the real lumen surface.
 */
export type RingSpec = { center: V3; axis: V3; radius: number };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function tubeAt(t: TubePath, u: number): { p: V3; dir: V3; r: number } {
  const f = Math.min(Math.max(u, 0), 0.9999) * (t.pts.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = t.pts[i], b = t.pts[i + 1];
  const p: V3 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  return { p, dir: norm(sub(b, a)), r: t.radii[i] + (t.radii[i + 1] - t.radii[i]) * k };
}

export const lumenAny = (p: V3) => Math.min(lumenLeft(p), lumenRight(p));
const snapLumen = (p: V3, inset = 0.02) => snapToSurface(lumenAny, p, -inset);

export type ValveId = "tricuspid" | "mitral" | "pulmonary" | "aortic";
export const VALVE_DEFS: Record<ValveId, { tube: TubePath; u: number; leaflets: number; angles: number[]; kind: "av" | "semilunar"; name: string; physiology: string }> = {
  tricuspid: { tube: TUBES.tricCh, u: 0.42, leaflets: 3, angles: [20, 90, 160], kind: "av", name: "Tricuspid valve", physiology: "Three leaflets guard the right atrioventricular orifice. Open in diastole and atrial systole; shut at the start of ventricular systole so blood cannot flow back into the right atrium. Chordae tendineae stop the leaflets prolapsing." },
  mitral: { tube: TUBES.mitCh, u: 0.4, leaflets: 2, angles: [35, 145], kind: "av", name: "Mitral valve", physiology: "Two leaflets (anterior and posterior) guard the left atrioventricular orifice. Open in diastole and atrial systole; shut during ventricular systole, withstanding the highest pressure in the heart." },
  pulmonary: { tube: TUBES.pa, u: 0.2, leaflets: 3, angles: [25, 90, 155], kind: "semilunar", name: "Pulmonary valve", physiology: "Three semilunar cusps at the base of the pulmonary trunk. Open when right ventricular pressure exceeds pulmonary artery pressure; close in early diastole to stop back-flow." },
  aortic: { tube: TUBES.ao, u: 0.1, leaflets: 3, angles: [25, 90, 155], kind: "semilunar", name: "Aortic valve", physiology: "Three semilunar cusps at the aortic root. Open when left ventricular pressure exceeds aortic pressure; close at the dicrotic notch. The coronary arteries arise just above the cusps and fill in diastole." },
};

export function valveRing(id: ValveId): RingSpec {
  const d = VALVE_DEFS[id];
  const { p, dir, r } = tubeAt(d.tube, d.u);
  return { center: p, axis: dir, radius: r * 0.96 };
}

export type Tract = { id: string; name: string; physiology: string; pts: V3[]; radius: number; color: string; phase: number[] };

const withS = (pts: V3[]): number[] => {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const L = s[s.length - 1] || 1;
  return s.map((x) => x / L);
};
const smooth = (ctrl: V3[], snap: (p: V3) => V3, per = 6): V3[] => sampleCurve(ctrl, per).map(snap);

/** Septum boundaries on the cut plane: x of the RV-side and LV-side faces of the septum at height y. */
export function septumEdges(y: number): { right: number; left: number } | null {
  const march = (f: (p: V3) => number, from: number, to: number) => {
    let prev = f([from, y, ZC - 0.001]);
    const dir = Math.sign(to - from);
    for (let x = from + dir * 0.01; dir * (to - x) > 0; x += dir * 0.01) {
      const cur = f([x, y, ZC - 0.001]);
      if (prev > 0 !== cur > 0) return x;
      prev = cur;
    }
    return null;
  };
  const rvSide = march(OUTER_LV, -1.4, 0.9); // enters LV outer solid going right
  const lvSide = march(LUMEN_LV, -0.8, 1.4); // enters LV lumen
  if (rvSide === null || lvSide === null) return null;
  return { right: rvSide, left: lvSide };
}

export function buildLayout() {
  const sa = snapLumen([-1.92, 1.5, -0.3], 0.03);
  const av = snapLumen([-0.98, 0.62, -0.3], 0.03);
  const inter = (waypoints: V3[]) => smooth([sa, ...waypoints.map((w) => snapLumen(w)), av], (p) => snapLumen(p));
  const anterior = inter([[-1.78, 1.32, -0.04], [-1.42, 1.0, -0.02], [-1.12, 0.74, -0.08]]);
  const middle = inter([[-1.72, 1.24, -0.3], [-1.4, 0.92, -0.38], [-1.1, 0.7, -0.3]]);
  const posterior = inter([[-1.62, 1.2, -0.62], [-1.36, 0.82, -0.66], [-1.06, 0.62, -0.5]]);
  const bachmannCtrl: V3[] = [snapLumen([-1.66, 1.58, -0.2], 0.03), [-1.2, 1.66, -0.52], [-0.7, 1.72, -0.78], [-0.1, 1.7, -0.8], [0.5, 1.66, -0.62], snapLumen([1.0, 1.6, -0.45], 0.03)];
  const bachmann = sampleCurve(bachmannCtrl, 8);

  // His and bundle branches lie on the septum, drawn just in front of the cut face.
  const zf = ZC + 0.014;
  const top = septumEdges(0.12) ?? { right: -0.4, left: 0.0 };
  const hisStart: V3 = [(top.right + top.left) / 2 - 0.06, 0.34, zf];
  const hisEnd: V3 = [(top.right + top.left) / 2, 0.1, zf];
  const his = sampleCurve([av, [-0.78, 0.5, -0.12], [hisStart[0], hisStart[1], zf], hisEnd], 6);
  const rbb: V3[] = [hisEnd], lbb: V3[] = [hisEnd];
  for (let y = 0.0; y > -1.28; y -= 0.1) {
    const e = septumEdges(y);
    if (!e) break;
    rbb.push([e.right + 0.05, y, zf]);
    lbb.push([e.left - 0.05, y, zf]);
  }
  const rbbEnd = rbb[rbb.length - 1], lbbEnd = lbb[lbb.length - 1];
  // curve the branches out to the apices along the lumen floor
  const rvApex = snapToSurface(LUMEN_RV, [-0.4, -1.35, -0.12], -0.02);
  const lvApex = snapToSurface(LUMEN_LV, [1.05, -1.5, -0.12], -0.02);
  const rbbPts = sampleCurve([...rbb, [rbbEnd[0] + 0.05, rbbEnd[1] - 0.12, -0.04], rvApex], 4);
  const lbbPts = sampleCurve([...lbb, [lbbEnd[0] + 0.2, lbbEnd[1] - 0.14, -0.04], lvApex], 4);

  const tr = (id: string, name: string, physiology: string, pts: V3[], radius: number, color: string): Tract => ({ id, name, physiology, pts, radius, color, phase: withS(pts) });
  const tracts: Tract[] = [
    tr("InternodalTractAnterior", "Anterior internodal tract", "Preferential atrial pathway from the SA node toward the AV node (and, via Bachmann's bundle, the left atrium). Atrial depolarisation spreads through ordinary atrial myocardium as well.", anterior, 0.018, "#facc15"),
    tr("InternodalTractMiddle", "Middle internodal tract", "Preferential atrial pathway from the SA node toward the AV node.", middle, 0.018, "#facc15"),
    tr("InternodalTractPosterior", "Posterior internodal tract", "Preferential atrial pathway from the SA node toward the AV node.", posterior, 0.018, "#facc15"),
    tr("BachmannsBundle", "Bachmann's bundle", "Interatrial band carrying the impulse from the right to the left atrium, so both atria contract almost together.", bachmann, 0.022, "#fbbf24"),
    tr("BundleOfHis", "Bundle of His", "The only normal electrical connection between atria and ventricles. It penetrates the fibrous skeleton and the upper interventricular septum, then divides into the bundle branches.", his, 0.04, "#38bdf8"),
    tr("RightBundleBranch", "Right bundle branch", "Runs down the right side of the septum to the apex of the right ventricle.", rbbPts, 0.026, "#38bdf8"),
    tr("LeftBundleBranch", "Left bundle branch", "Fans out on the left side of the septum and divides into anterior and posterior fascicles to the left ventricle.", lbbPts, 0.03, "#38bdf8"),
  ];

  return { sa, av, tracts, rvApex, lvApex, hisEnd };
}
export type HeartLayout = ReturnType<typeof buildLayout>;

// ---- Purkinje network ------------------------------------------------------------------------------------------------------
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Branch = { pts: V3[]; s: number[] };

/** Fractal-ish Purkinje network on a ventricular endocardial surface, growing from the apex up the lateral wall (seeded, deterministic). */
export function purkinjeNetwork(lumen: (p: V3) => number, root: V3, upward: V3, seed: number, budget = 160): Branch[] {
  const rnd = rng(seed);
  const snap = (p: V3) => snapToSurface(lumen, p, -0.012);
  const out: Branch[] = [];
  const grow = (start: V3, dir: V3, depth: number, s0: number) => {
    const pts: V3[] = [start];
    const s: number[] = [s0];
    let p = start, d = dir;
    const steps = Math.max(3, Math.round((7 - depth) * (1.2 + rnd())));
    for (let i = 0; i < steps && out.reduce((a, b) => a + b.pts.length, 0) < budget * 6; i++) {
      // random walk in the tangent plane, biased along `upward`
      const n = gradient(lumen, p);
      const jitter: V3 = [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7];
      let nd: V3 = [d[0] * 0.75 + upward[0] * 0.25 + jitter[0], d[1] * 0.75 + upward[1] * 0.25 + jitter[1], d[2] * 0.75 + upward[2] * 0.25 + jitter[2]];
      const dn = nd[0] * n[0] + nd[1] * n[1] + nd[2] * n[2];
      nd = [nd[0] - dn * n[0], nd[1] - dn * n[1], nd[2] - dn * n[2]];
      d = norm(nd);
      const step = 0.1 * (1 - depth * 0.08);
      const q = snap([p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step]);
      pts.push(q);
      s.push(s[s.length - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
      p = q;
      if (depth < 4 && rnd() < 0.34) {
        const side: V3 = norm([d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]]);
        const sgn = rnd() < 0.5 ? -1 : 1;
        grow(p, norm([d[0] + side[0] * sgn * 0.9, d[1] + side[1] * sgn * 0.9, d[2] + side[2] * sgn * 0.9]), depth + 1, s[s.length - 1]);
      }
    }
    out.push({ pts, s });
  };
  const r0 = snap(root);
  for (let k = 0; k < 3; k++) grow(r0, norm([upward[0] + (k - 1) * 0.5, upward[1], upward[2] + (k - 1) * 0.35]), 0, 0);
  const smax = Math.max(...out.flatMap((b) => b.s)) || 1;
  return out.map((b) => ({ pts: b.pts, s: b.s.map((x) => x / smax) }));
}

export { solid, lumenLeft, lumenRight, LUMEN_LV, LUMEN_RV };
