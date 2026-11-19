import { TISSUE_NODES, TISSUE_BY_ID, type BeatElectrophysiology, type TissueNodeId } from "@/sim/cardiac-ep";

/**
 * Electromechanical coupling (spec §15), SCHEMATIC.
 * Force of a tissue node = smooth (raised-cosine) rise starting `emdMs` after its electrical onset, held until
 * repolarisation starts, then a raised-cosine relaxation. Chamber contraction is the mass-weighted mean of its nodes.
 * There is no pressure/volume (Frank–Starling, valve flow) model: valve states and volumes are simple, labelled
 * consequences of contraction state, not computed haemodynamics.
 */
export const MECHANICS_PARAMS = {
  atrialRiseMs: 70,
  ventricularRiseMs: 110,
  relaxMs: 130,
  /** Relaxation starts this long after the node's repolarisation start. */
  relaxLagMs: -30,
  /** LV/RV cavity volumes (mL), purely illustrative scale for the volume read-out. */
  lvEdvMl: 120, lvEsvMl: 50, rvEdvMl: 130, rvEsvMl: 60, laMaxMl: 60, laMinMl: 35,
  /** Thresholds (fraction of full contraction) used only to label phases. */
  isovolumicThreshold: 0.03,
  ejectionThreshold: 0.28,
  atrialSystoleThreshold: 0.05,
};

const rise = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));

export function nodeForce(beat: BeatElectrophysiology, id: TissueNodeId, t: number): number {
  const on = beat.onset[id];
  if (on === undefined) return 0;
  const n = TISSUE_BY_ID[id];
  const P = MECHANICS_PARAMS;
  const riseMs = n.chamber === "atrial" ? P.atrialRiseMs : P.ventricularRiseMs;
  const up = rise((t - (on + n.emdMs)) / riseMs);
  if (up === 0) return 0;
  const relaxStart = beat.repolStart[id]! + P.relaxLagMs;
  return up * (1 - rise((t - relaxStart) / P.relaxMs));
}

export type WallState = { id: TissueNodeId; contraction: number };

export type MechanicalPhase =
  | "Diastole: passive filling"
  | "Atrial systole"
  | "Isovolumic contraction"
  | "Ventricular ejection"
  | "Isovolumic relaxation";

export type MechanicalState = {
  timeMs: number;
  /** 0..1 contraction of each tissue node. */
  nodes: Record<TissueNodeId, number>;
  rightAtrium: number; leftAtrium: number; septum: number; rightVentricle: number; leftVentricle: number;
  /** Mass-weighted ventricular contraction (0..1) and its sign of change. */
  ventricular: number;
  atrial: number;
  /** Apex moves toward the base as the LV shortens (0..1 of full excursion). */
  apexShortening: number;
  /** Base descent toward the apex (0..1 of full excursion). */
  baseDescent: number;
  wallThickening: number;
  lvVolumeMl: number; rvVolumeMl: number; laVolumeMl: number;
  valves: { mitral: "open" | "closed"; tricuspid: "open" | "closed"; aortic: "open" | "closed"; pulmonic: "open" | "closed" };
  phase: MechanicalPhase;
};

const group = (nodes: Record<TissueNodeId, number>, ids: TissueNodeId[]) => ids.reduce((a, i) => a + nodes[i], 0) / ids.length;

export function mechanicsAt(beats: BeatElectrophysiology[], t: number, dtMs = 5): MechanicalState {
  const P = MECHANICS_PARAMS;
  const calc = (tt: number) => {
    const nodes = {} as Record<TissueNodeId, number>;
    for (const n of TISSUE_NODES) {
      let f = 0;
      for (const b of beats) if (b.onset[n.id] !== undefined && tt >= b.onset[n.id]! && tt <= b.repolStart[n.id]! + 600) f += nodeForce(b, n.id, tt);
      nodes[n.id] = Math.min(1, f);
    }
    return nodes;
  };
  const nodes = calc(t);
  const prev = calc(t - dtMs);
  const sel = (g: string) => TISSUE_NODES.filter((n) => n.group === g).map((n) => n.id);
  const v = (nn: Record<TissueNodeId, number>) => group(nn, [...sel("septum"), ...sel("rightVentricle"), ...sel("leftVentricle")]);
  const a = (nn: Record<TissueNodeId, number>) => group(nn, [...sel("rightAtrium"), ...sel("leftAtrium")]);
  const ventricular = v(nodes);
  const atrial = a(nodes);
  const lv = group(nodes, sel("leftVentricle"));
  const rv = group(nodes, sel("rightVentricle"));
  const vRising = ventricular > v(prev) + 1e-6;
  const aRising = atrial > a(prev) + 1e-6;

  let phase: MechanicalPhase;
  if (ventricular < P.isovolumicThreshold) phase = atrial > P.atrialSystoleThreshold ? "Atrial systole" : "Diastole: passive filling";
  else if (vRising) phase = ventricular < P.ejectionThreshold ? "Isovolumic contraction" : "Ventricular ejection";
  else phase = ventricular >= P.ejectionThreshold ? "Ventricular ejection" : "Isovolumic relaxation";
  void aRising;

  const ventEjecting = phase === "Ventricular ejection";
  const avClosed = ventricular >= P.isovolumicThreshold && phase !== "Diastole: passive filling" && phase !== "Atrial systole";
  return {
    timeMs: t,
    nodes,
    rightAtrium: group(nodes, sel("rightAtrium")),
    leftAtrium: group(nodes, sel("leftAtrium")),
    septum: group(nodes, sel("septum")),
    rightVentricle: rv,
    leftVentricle: lv,
    ventricular,
    atrial,
    apexShortening: lv * 0.5 + ventricular * 0.5,
    baseDescent: group(nodes, ["lvbEndo", "lvbEpi", "lvlEndo", "lvlEpi"]),
    wallThickening: ventricular,
    lvVolumeMl: P.lvEdvMl - (P.lvEdvMl - P.lvEsvMl) * lv,
    rvVolumeMl: P.rvEdvMl - (P.rvEdvMl - P.rvEsvMl) * rv,
    laVolumeMl: P.laMaxMl - (P.laMaxMl - P.laMinMl) * group(nodes, sel("leftAtrium")),
    valves: {
      mitral: avClosed ? "closed" : "open",
      tricuspid: avClosed ? "closed" : "open",
      aortic: ventEjecting ? "open" : "closed",
      pulmonic: ventEjecting ? "open" : "closed",
    },
    phase,
  };
}
