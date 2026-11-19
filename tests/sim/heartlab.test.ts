import { describe, expect, it } from "vitest";
import { EcgEngine, heartRhythmInput, heartVisual, findRhythm, HEART_RHYTHMS, clampBpm } from "@/sim/ecg";

const engine = (input?: ReturnType<typeof heartRhythmInput>) => { const e = new EcgEngine({}); if (input) e.apply(input); e.ensureUntil(20000); return e; };
const scan = (e: EcgEngine, from: number, to: number, step = 5) => { const out = []; for (let t = from; t <= to; t += step) { e.timeMs = t; out.push(heartVisual(e, t)); } return out; };

describe("heart visual state is derived from the ECG engine", () => {
  const e = engine();
  const b = e.beats[4].ep;
  const frames = scan(e, b.saMs - 50, b.saMs + 900);
  const at = (ms: number) => frames.find((f) => f.timeMs >= ms)!;

  it("atria contract before the ventricles; the AV valves are open during atrial systole and the semilunar valves closed", () => {
    const f = frames.filter((x) => x.la > 0.3 && x.lv < 0.02);
    expect(f.length).toBeGreaterThan(5);
    for (const x of f) { expect(x.valves.mitral).toBeGreaterThan(0.55); expect(x.valves.aortic).toBeLessThan(0.1); expect(x.valves.pulmonary).toBeLessThan(0.1); }
    expect(f.filter((x) => x.valves.mitral > 0.95).length).toBeGreaterThan(f.length * 0.7);
    const tAtrial = frames.find((x) => x.la > 0.3)!.timeMs, tVent = frames.find((x) => x.lv > 0.3)!.timeMs;
    expect(tVent - tAtrial).toBeGreaterThan(120);
  });
  it("during ventricular ejection the AV valves are shut and the semilunar valves open", () => {
    const f = frames.filter((x) => x.mechanics.phase === "Ventricular ejection");
    expect(f.length).toBeGreaterThan(20);
    const mid = f[Math.floor(f.length / 2)];
    expect(mid.valves.tricuspid).toBeLessThan(0.1); expect(mid.valves.mitral).toBeLessThan(0.1);
    expect(mid.valves.aortic).toBeGreaterThan(0.9); expect(mid.valves.pulmonary).toBeGreaterThan(0.9);
    expect(mid.lv).toBeGreaterThan(0.5);
  });
  it("the impulse travels in order SA → internodal → AV → His → bundles; His is reached after the AV delay", () => {
    const seq = ["saNode->raHigh", "raLow->avNode", "avNode->hisBundle", "hisBundle->leftBundle"];
    const firstSeen = seq.map((id) => frames.find((x) => x.edge[id] !== undefined && x.edge[id] < 1)?.timeMs ?? Infinity);
    for (let i = 1; i < seq.length; i++) expect(firstSeen[i]).toBeGreaterThan(firstSeen[i - 1]);
    // AV nodal conduction takes about the configured delay
    const av = frames.filter((x) => x.edge["avNode->hisBundle"] !== undefined && x.edge["avNode->hisBundle"] < 1);
    expect(av.length * 5).toBeGreaterThan(60);
  });
  it("wavefront progress increases monotonically inside an edge", () => {
    const p = frames.filter((x) => x.timeMs < b.saMs + 700).map((x) => x.edge["avNode->hisBundle"]).filter((v): v is number => v !== undefined && v < 1);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
  });
  it("is a pure function of simulation time (same t → same state)", () => {
    expect(JSON.stringify(heartVisual(e, 4321).edge)).toBe(JSON.stringify(heartVisual(e, 4321).edge));
    expect(heartVisual(e, 4321).lv).toBe(heartVisual(e, 4321).lv);
    void at;
  });
});

describe("2:1 AV block", () => {
  const input = heartRhythmInput("av-block-2-1", 100)!;
  const e = engine(input);
  it("ventricular rate is half the atrial rate and blocked beats do not activate the ventricles", () => {
    const f = scan(e, 6000, 12000, 10).filter((x) => x.atrialRate && x.ventricularRate);
    const last = f[f.length - 1];
    expect(last.atrialRate!).toBeCloseTo(100, -1);
    expect(last.ventricularRate!).toBeCloseTo(50, -1);
    // beats alternate conducted / blocked
    const flags = e.beats.slice(6, 16).map((b) => b.ep.conductedToVentricles);
    for (let i = 1; i < flags.length; i++) expect(flags[i]).toBe(!flags[i - 1]);
  });
  it("on a blocked beat the atria contract, the ventricles do not, and the block is reported at the AV node", () => {
    const blockedBeat = e.beats.slice(6, 14).find((b) => !b.ep.conductedToVentricles)!.ep;
    const frames = scan(e, blockedBeat.saMs, blockedBeat.saMs + 500);
    expect(Math.max(...frames.map((x) => x.la))).toBeGreaterThan(0.5);
    // the previous conducted beat's ventricular contraction may still be relaxing at the start; check the window after it
    const late = frames.filter((x) => x.timeMs > blockedBeat.saMs + 200);
    expect(Math.max(...late.map((x) => x.lv))).toBeLessThan(0.2);
    expect(frames.some((x) => x.blocked.includes("avNode->hisBundle"))).toBe(true);
    expect(frames.every((x) => (x.edge["hisBundle->leftBundle"] ?? 0) === 0 || x.edge["hisBundle->leftBundle"] >= 1 || x.timeMs < blockedBeat.saMs + 100)).toBe(true);
  });
});

describe("rhythm list and input mapping", () => {
  it("AF and VT are listed but not simulated (no faked waveform): no engine input is produced", () => {
    expect(findRhythm("Atrial Fibrillation")!.supported).toBe(false);
    expect(findRhythm("vt")!.supported).toBe(false);
    expect(heartRhythmInput("af", 80)).toBeNull();
    expect(heartRhythmInput("Ventricular Tachycardia", 80)).toBeNull();
    expect(HEART_RHYTHMS.filter((r) => r.supported).map((r) => r.id)).toEqual(["nsr", "av-block-2-1", "lbbb", "rbbb"]);
  });
  it("accepts the spec's display names and clamps BPM to 40–180", () => {
    expect(findRhythm("2:1 AV Block")!.id).toBe("av-block-2-1");
    expect(findRhythm("Normal Sinus Rhythm")!.id).toBe("nsr");
    expect(clampBpm(10)).toBe(40); expect(clampBpm(400)).toBe(180);
    const i = heartRhythmInput("nsr", 130)!;
    expect(i.type === "replaceConfig" && i.config.sinusRateBpm).toBe(130);
  });
  it("a heart-rate change reaches the engine and the measured atrial rate", () => {
    const e = engine(heartRhythmInput("nsr", 150)!);
    const f = heartVisual(e, 12000);
    expect(f.atrialRate!).toBeCloseTo(150, -1);
  });
});
