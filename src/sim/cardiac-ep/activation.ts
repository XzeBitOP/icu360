import type { ActivationEvent, ConductionEdge, EcgConfig, NodeId, TissueNodeId } from "./types";
import { ATRIAL_NODE_IDS, REGION_NODES, TISSUE_BY_ID, TISSUE_NODES, VENTRICULAR_NODE_IDS, defaultEdges } from "./model";

export const AV_EDGE_ID = "avNode->hisBundle";

export type EdgeTransit = {
  edgeId: string;
  from: NodeId;
  to: NodeId;
  /** Absolute ms the impulse leaves `from`. */
  startMs: number;
  /** Absolute ms it arrives at `to` (if conducted). */
  endMs: number;
  /** True if the impulse actually propagated along this edge (it determined, or tied for, arrival at `to`). */
  conducted: boolean;
  /** True if the edge was blocked (disabled / factor <= 0 / AV conduction model dropped the beat) while `from` was active. */
  blocked: boolean;
};

export type BeatElectrophysiology = {
  index: number;
  saMs: number;
  /** AV nodal conduction time used for this beat; null = impulse blocked at AV node. */
  avDelayMs: number | null;
  conductedToVentricles: boolean;
  /** Absolute activation onset of each reached node. */
  onset: Partial<Record<NodeId, number>>;
  /** Absolute time repolarisation starts (onset + APD) for each reached tissue node. */
  repolStart: Partial<Record<TissueNodeId, number>>;
  /** APD actually used (ms). */
  apd: Partial<Record<TissueNodeId, number>>;
  transits: EdgeTransit[];
  events: ActivationEvent[];
  fiducials: {
    pOnsetMs: number;
    pEndMs: number;
    qrsOnsetMs?: number;
    qrsEndMs?: number;
    tEndMs?: number;
  };
  rrPrevMs: number | null;
};

export function applyOverrides(config: EcgConfig): ConductionEdge[] {
  return defaultEdges().map((e) => {
    const o = config.edgeOverrides[e.id];
    return o ? { ...e, enabled: o.enabled ?? e.enabled, conductionFactor: o.conductionFactor ?? e.conductionFactor } : e;
  });
}

export function effectiveDelayMs(e: ConductionEdge, config: EcgConfig, avDelayMs: number | null): number | null {
  if (!e.enabled || e.conductionFactor <= 0) return null;
  let d = e.delayMs;
  if (e.id === AV_EDGE_ID) {
    if (avDelayMs === null) return null;
    d = avDelayMs;
  }
  d /= e.conductionFactor;
  if (e.kind === "myocardial") d /= Math.max(config.myocardialConductionFactor, 1e-6);
  return d;
}

/**
 * Earliest-arrival propagation over the conduction graph (Dijkstra). A block really prevents/delays propagation:
 * nodes only get an onset if an unblocked path reaches them.
 */
export function computeBeat(
  config: EcgConfig,
  index: number,
  saMs: number,
  avDelayMs: number | null,
  rrPrevMs: number | null,
  edges: ConductionEdge[] = applyOverrides(config),
): BeatElectrophysiology {
  const arrival = new Map<NodeId, number>();
  arrival.set("saNode", saMs);
  const done = new Set<NodeId>();
  const out = new Map<NodeId, ConductionEdge[]>();
  for (const e of edges) {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from)!.push(e);
  }
  for (;;) {
    let best: NodeId | null = null;
    let bt = Infinity;
    for (const [n, t] of arrival) if (!done.has(n) && t < bt) { best = n; bt = t; }
    if (best === null) break;
    done.add(best);
    for (const e of out.get(best) ?? []) {
      const d = effectiveDelayMs(e, config, avDelayMs);
      if (d === null) continue;
      const t = bt + d;
      const cur = arrival.get(e.to);
      if (cur === undefined || t < cur - 1e-9) arrival.set(e.to, t);
    }
  }
  const onset: Partial<Record<NodeId, number>> = {};
  for (const [n, t] of arrival) onset[n] = t;

  const transits: EdgeTransit[] = [];
  for (const e of edges) {
    const t0 = arrival.get(e.from);
    if (t0 === undefined) continue;
    const d = effectiveDelayMs(e, config, avDelayMs);
    if (d === null) {
      transits.push({ edgeId: e.id, from: e.from, to: e.to, startMs: t0, endMs: t0, conducted: false, blocked: true });
    } else {
      const arr = arrival.get(e.to);
      transits.push({ edgeId: e.id, from: e.from, to: e.to, startMs: t0, endMs: t0 + d, conducted: arr !== undefined && Math.abs(arr - (t0 + d)) < 1e-6, blocked: false });
    }
  }

  // Repolarisation: rate-adapted APD, shortened for late-activated tissue (activation–repolarisation coupling)
  const rr = rrPrevMs ?? 60000 / config.sinusRateBpm;
  const rateScale = config.rateAdaptation ? Math.min(1.25, Math.max(0.55, Math.sqrt(rr / 1000))) : 1;
  const firstOf = (ids: TissueNodeId[]) => Math.min(...ids.map((i) => onset[i] ?? Infinity));
  const tRefAtrial = firstOf(ATRIAL_NODE_IDS);
  const tRefVent = firstOf(VENTRICULAR_NODE_IDS);
  const apd: Partial<Record<TissueNodeId, number>> = {};
  const repolStart: Partial<Record<TissueNodeId, number>> = {};
  for (const n of TISSUE_NODES) {
    const on = onset[n.id];
    if (on === undefined) continue;
    const tRef = n.chamber === "atrial" ? tRefAtrial : tRefVent;
    const a = Math.max(60, n.apdMs * rateScale - config.apdCoupling * (on - tRef));
    apd[n.id] = a;
    repolStart[n.id] = on + a;
  }

  const events: ActivationEvent[] = [];
  const spanOf = (ids: NodeId[]) => {
    const os = ids.map((i) => onset[i]).filter((v): v is number => v !== undefined);
    if (!os.length) return null;
    const ends = ids.map((i) => (onset[i] === undefined ? undefined : onset[i]! + (TISSUE_BY_ID[i as TissueNodeId]?.upstrokeMs ?? 10))).filter((v): v is number => v !== undefined);
    return { on: Math.min(...os), end: Math.max(...ends) };
  };
  for (const [region, ids] of Object.entries(REGION_NODES)) {
    const s = spanOf(ids);
    if (s) events.push({ region: region as ActivationEvent["region"], onsetMs: s.on, durationMs: Math.max(s.end - s.on, 1), activationStrength: 1 });
  }
  // Purkinje network: union of terminal-fibre (kind "purkinje") transits that conducted
  const pk = transits.filter((t) => t.conducted && edges.find((e) => e.id === t.edgeId)?.kind === "purkinje");
  if (pk.length) {
    const on = Math.min(...pk.map((t) => t.startMs));
    const end = Math.max(...pk.map((t) => t.endMs));
    events.push({ region: "purkinje", onsetMs: on, durationMs: Math.max(end - on, 1), activationStrength: 1 });
  }

  const atrOn = ATRIAL_NODE_IDS.map((i) => onset[i]).filter((v): v is number => v !== undefined);
  const ventIds = VENTRICULAR_NODE_IDS.filter((i) => onset[i] !== undefined);
  const fiducials: BeatElectrophysiology["fiducials"] = {
    pOnsetMs: Math.min(...atrOn),
    pEndMs: Math.max(...ATRIAL_NODE_IDS.filter((i) => onset[i] !== undefined).map((i) => onset[i]! + TISSUE_BY_ID[i].upstrokeMs)),
  };
  if (ventIds.length) {
    fiducials.qrsOnsetMs = Math.min(...ventIds.map((i) => onset[i]!));
    fiducials.qrsEndMs = Math.max(...ventIds.map((i) => onset[i]! + TISSUE_BY_ID[i].upstrokeMs));
    fiducials.tEndMs = Math.max(...ventIds.map((i) => repolStart[i]! + TISSUE_BY_ID[i].repolMs));
  }

  return {
    index, saMs, avDelayMs, conductedToVentricles: ventIds.length > 0, onset, repolStart, apd, transits, events, fiducials, rrPrevMs,
  };
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Transmembrane "activation" of a tissue node in one beat: 0 = resting, 1 = depolarised plateau. */
export function nodeVm(beat: BeatElectrophysiology, id: TissueNodeId, t: number): number {
  const on = beat.onset[id];
  if (on === undefined) return 0;
  const n = TISSUE_BY_ID[id];
  const up = smooth((t - on) / n.upstrokeMs);
  if (up === 0) return 0;
  const rs = beat.repolStart[id]!;
  return up * (1 - smooth((t - rs) / n.repolMs));
}

/** Last time anything in this beat is still changing (end of repolarisation). */
export function beatEndMs(beat: BeatElectrophysiology): number {
  let m = beat.fiducials.pEndMs;
  for (const id of Object.keys(beat.repolStart) as TissueNodeId[]) m = Math.max(m, beat.repolStart[id]! + TISSUE_BY_ID[id].repolMs);
  return m;
}
