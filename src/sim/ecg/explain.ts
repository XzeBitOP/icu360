import { HEART_STRUCTURES, nodeVm, REGION_NODES, TISSUE_BY_ID, VENTRICULAR_NODE_IDS, type BeatElectrophysiology, type EdgeTransit, type NodeId, type TissueNodeId } from "@/sim/cardiac-ep";
import { mechanicsAt, type MechanicalState } from "@/sim/cardiac-mech";
import type { EcgEngine } from "./engine";

export type WaveSegment = "P" | "PR segment" | "QRS" | "ST segment" | "T" | "TP / baseline";

export type EventDescription = {
  timeMs: number;
  segment: WaveSegment;
  /** Beat the point belongs to (nearest preceding), if any. */
  beatIndex: number | null;
  msIntoSegment: number | null;
  title: string;
  electrical: string;
  mechanical: string;
  activeStructureIds: string[];
  mechanics: MechanicalState;
};

const CS_NODES: NodeId[] = ["saNode", "avNode", "hisBundle", "rightBundle", "leftBundle", "leftAnteriorFascicle", "leftPosteriorFascicle"];

export type StructureState = "resting" | "activating" | "plateau" | "repolarising" | "blocked";
export type StructureActivity = { activation: number; state: StructureState; contraction: number };

/** Structure activity (for highlight colours and animation) derived from node activation at t. */
export function structureActivity(engine: EcgEngine, t: number): Record<string, StructureActivity> {
  const beats = engine.beatsNear(t);
  const mech = mechanicsAt(beats, t);
  const out: Record<string, StructureActivity> = {};
  const vm = (id: TissueNodeId, tt: number) => Math.min(1, beats.reduce((a, b) => a + nodeVm(b, id, tt), 0));
  const regionState = (ids: TissueNodeId[]): StructureActivity => {
    const now = ids.reduce((a, i) => a + vm(i, t), 0) / ids.length;
    const before = ids.reduce((a, i) => a + vm(i, t - 8), 0) / ids.length;
    let state: StructureState = "resting";
    if (now > 0.02) state = now > before + 0.004 ? "activating" : now < before - 0.004 ? "repolarising" : "plateau";
    return { activation: now, state, contraction: 0 };
  };
  const csGlow = (id: NodeId): StructureActivity => {
    let act = 0;
    let state: StructureState = "resting";
    for (const b of beats) {
      const on = b.onset[id];
      if (on === undefined) continue;
      const dt = t - on;
      if (dt >= 0 && dt < 160) {
        const a = dt < 25 ? 1 : Math.exp(-(dt - 25) / 45);
        if (a > act) { act = a; state = dt < 25 ? "activating" : "plateau"; }
      }
    }
    return { activation: act, state, contraction: 0 };
  };
  for (const s of HEART_STRUCTURES) {
    let st: StructureActivity;
    switch (s.id) {
      case "saNode": case "avNode": case "hisBundle": case "rightBundle": case "leftBundle":
      case "leftAnteriorFascicle": case "leftPosteriorFascicle":
        st = csGlow(s.id as NodeId); break;
      case "bachmann": st = regionState(["laHigh"]); break;
      case "atrialPathways": st = regionState(["raLow"]); break;
      case "rightAtrium": st = regionState(["raHigh", "raLow"]); st.contraction = mech.rightAtrium; break;
      case "leftAtrium": st = regionState(["laHigh", "laLow"]); st.contraction = mech.leftAtrium; break;
      case "septum": st = regionState(["sepL", "sepR"]); st.contraction = mech.septum; break;
      case "rightVentricle": st = regionState(["rvEndo", "rvEpi", "rvoEndo", "rvoEpi"]); st.contraction = mech.rightVentricle; break;
      case "leftVentricle": st = regionState(["lvaEndo", "lvaEpi", "lvlEndo", "lvlEpi", "lviEndo", "lviEpi", "lvbEndo", "lvbEpi"]); st.contraction = mech.leftVentricle; break;
      case "apex": st = regionState(["lvaEndo", "lvaEpi"]); st.contraction = mech.nodes.lvaEndo; break;
      case "base": st = regionState(["lvbEndo", "lvbEpi", "rvoEndo", "rvoEpi"]); st.contraction = mech.nodes.lvbEndo; break;
      case "purkinje": {
        let act = 0;
        for (const b of beats) {
          const ev = b.events.find((e) => e.region === "purkinje");
          if (ev && t >= ev.onsetMs && t <= ev.onsetMs + ev.durationMs + 40) act = 1;
        }
        st = { activation: act, state: act ? "activating" : "resting", contraction: 0 };
        break;
      }
      default: st = { activation: 0, state: "resting", contraction: 0 };
    }
    out[s.id] = st;
  }
  return out;
}

/** Edge transits (impulse in motion along a conduction edge) at time t, with progress 0..1. */
export function activeTransits(engine: EcgEngine, t: number): (EdgeTransit & { progress: number })[] {
  const res: (EdgeTransit & { progress: number })[] = [];
  for (const b of engine.beatsNear(t)) {
    for (const tr of b.transits) {
      if (!tr.conducted) continue;
      if (t >= tr.startMs && t <= tr.endMs && tr.endMs > tr.startMs) res.push({ ...tr, progress: (t - tr.startMs) / (tr.endMs - tr.startMs) });
    }
  }
  return res;
}

/** Blocked edges (the impulse reached `from` but could not cross) for the most recent beats, for "where is the block" displays. */
export function blockedEdges(engine: EcgEngine, t: number): string[] {
  const set = new Set<string>();
  for (const b of engine.beatsNear(t, 1200)) for (const tr of b.transits) if (tr.blocked) set.add(tr.edgeId);
  return [...set];
}

function beatAt(engine: EcgEngine, t: number): BeatElectrophysiology | null {
  let found: BeatElectrophysiology | null = null;
  for (const r of engine.beats) {
    if (r.ep.fiducials.pOnsetMs - 60 <= t) found = r.ep;
    else break;
  }
  return found;
}

/** What is the heart doing, electrically and mechanically, at time t? (spec milestone 1 completion criterion) */
export function describeAt(engine: EcgEngine, t: number): EventDescription {
  const beats = engine.beatsNear(t);
  const mech = mechanicsAt(beats, t);
  const act = structureActivity(engine, t);
  const beat = beatAt(engine, t);
  let segment: WaveSegment = "TP / baseline";
  let msInto: number | null = null;
  let title = "Baseline (TP segment)";
  let electrical = "No net electrical activity: all cells are at rest, so the surface ECG is isoelectric.";

  // choose the most relevant recent beat
  const candidates = beats.length ? beats : beat ? [beat] : [];
  for (const b of candidates) {
    const f = b.fiducials;
    const tOnset = f.qrsOnsetMs !== undefined ? Math.min(...VENTRICULAR_NODE_IDS.filter((i) => b.repolStart[i] !== undefined).map((i) => b.repolStart[i]!)) : undefined;
    if (t >= f.pOnsetMs && t <= f.pEndMs) {
      segment = "P"; msInto = t - f.pOnsetMs; title = "P wave: atrial depolarisation";
      const ra = act.rightAtrium.activation, la = act.leftAtrium.activation;
      electrical = la < 0.05 && ra > 0.05
        ? "The impulse has left the SA node and the right atrium is depolarising (early P wave). Activation travels down the right atrium and across Bachmann bundle."
        : "The left atrium is now depolarising via Bachmann bundle (terminal P wave), while the right atrium is already depolarised.";
      break;
    }
    if (f.qrsOnsetMs !== undefined && t > f.pEndMs && t < f.qrsOnsetMs) {
      segment = "PR segment"; msInto = t - f.pEndMs; title = "PR segment: AV node delay";
      electrical = act.avNode.activation > 0.2
        ? "The impulse is crossing the AV node, which conducts slowly. This delay lets the ventricles fill; the small voltages involved are invisible on the surface ECG, so the trace is flat."
        : "The impulse is travelling through the His bundle and bundle branches (also too small to see on the surface ECG).";
      break;
    }
    if (f.qrsOnsetMs !== undefined && f.qrsEndMs !== undefined && t >= f.qrsOnsetMs && t <= f.qrsEndMs) {
      segment = "QRS"; msInto = t - f.qrsOnsetMs; title = "QRS complex: ventricular depolarisation";
      const sepL = nodeVm(b, "sepL", t), sepR = nodeVm(b, "sepR", t);
      const earlySeptum = sepL > 0.02 && sepR < 0.5 && b.onset.sepL! <= (b.onset.lvaEndo ?? 1e12);
      const reverseSeptum = sepR > 0.02 && sepL < 0.5 && (b.onset.sepR ?? 1e12) < (b.onset.sepL ?? 1e12);
      if (earlySeptum) electrical = "Septal depolarisation: the left bundle activates the septum first, spreading left to right. This small early force can give a small r in V1 and a small q in I, aVL, V5, V6.";
      else if (reverseSeptum) electrical = "Septal depolarisation is running right to left (the left bundle is not conducting), so the normal initial left-to-right septal force is absent.";
      else {
        const late = ["lvbEndo", "lvbEpi", "rvoEndo", "rvoEpi"].some((i) => nodeVm(b, i as TissueNodeId, t) > 0.05 && nodeVm(b, i as TissueNodeId, t) < 0.95);
        electrical = late
          ? "Late activation of the basal regions (postero-basal LV and RV outflow): the terminal part of the QRS."
          : "Wavefront crossing the ventricular walls from endocardium to epicardium via Purkinje fibres: the main R/S forces. The left ventricle dominates because of its mass.";
      }
      break;
    }
    if (f.qrsEndMs !== undefined && tOnset !== undefined && t > f.qrsEndMs && t < tOnset) {
      segment = "ST segment"; msInto = t - f.qrsEndMs; title = "ST segment: ventricles depolarised";
      electrical = "Nearly all ventricular myocardium is depolarised (plateau), so there is little potential difference between regions and the trace is close to baseline.";
      break;
    }
    if (f.tEndMs !== undefined && tOnset !== undefined && t >= tOnset && t <= f.tEndMs) {
      segment = "T"; msInto = t - tOnset; title = "T wave: ventricular repolarisation";
      electrical = "Repolarisation spreads through the ventricles. In this model the epicardium repolarises before the endocardium, so the repolarisation vector points the same way as the main QRS vector and the T wave is upright where the QRS is mostly upright.";
      break;
    }
  }

  const mechText: Record<string, string> = {
    "Diastole: passive filling": "Ventricles relaxed and filling passively; AV valves open.",
    "Atrial systole": "Atria contracting after the P wave and topping up ventricular filling; AV valves open.",
    "Isovolumic contraction": "Ventricular force is rising with all valves closed; pressure builds before the semilunar valves open.",
    "Ventricular ejection": "Ventricles contracting and ejecting blood; aortic and pulmonic valves open (schematic).",
    "Isovolumic relaxation": "Ventricles relaxing with all valves closed; pressure falls.",
  };
  const mechanical = `${mech.phase}. ${mechText[mech.phase]} (Electromechanical delay: contraction follows activation by ~${TISSUE_BY_ID.lvaEndo.emdMs} ms, so it lags the QRS.)`;

  const activeStructureIds = Object.entries(act).filter(([, v]) => v.activation > 0.15 && v.state !== "resting").map(([k]) => k);
  void REGION_NODES; void CS_NODES;
  return { timeMs: t, segment, beatIndex: beat ? beat.index : null, msIntoSegment: msInto, title, electrical, mechanical, activeStructureIds, mechanics: mech };
}
