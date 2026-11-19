import { VENTRICULAR_NODE_IDS, type BeatElectrophysiology } from "@/sim/cardiac-ep";
import type { WaveKind } from "./store";

export const WAVE_COLORS: Record<WaveKind, string> = { P: "#7dd3fc", "PR segment": "#fbbf24", QRS: "#47cd89", T: "#c4b5fd" };
export const WAVE_LABEL: Record<WaveKind, string> = { P: "P", "PR segment": "PR", QRS: "QRS", T: "T" };

export type Band = { kind: WaveKind; from: number; to: number };

/** Wave segments of one beat, taken from the engine's own event timings (not templates). */
export function beatBands(b: BeatElectrophysiology): Band[] {
  const f = b.fiducials;
  const out: Band[] = [{ kind: "P", from: f.pOnsetMs, to: f.pEndMs }];
  if (f.qrsOnsetMs !== undefined && f.qrsEndMs !== undefined) {
    out.push({ kind: "PR segment", from: f.pEndMs, to: f.qrsOnsetMs });
    out.push({ kind: "QRS", from: f.qrsOnsetMs, to: f.qrsEndMs });
    const starts = VENTRICULAR_NODE_IDS.map((i) => b.repolStart[i]).filter((x): x is number => x !== undefined);
    if (starts.length && f.tEndMs !== undefined) out.push({ kind: "T", from: Math.min(...starts), to: f.tEndMs });
  }
  return out;
}
