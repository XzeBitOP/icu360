import { describe, expect, it } from "vitest";
import { SimulationRunner } from "@/sim/core";
import {
  EcgEngine, bazett, fridericia, frontalQrsAxisDeg, largeSquareMs, largeSquareMv, measureBeat, measurementsAt, smallSquareMs, smallSquareMv, LEAD_INDEX, DIPOLE_PAIRS,
} from "@/sim/ecg";
import { ECG_PRESETS, ECG_CONDITIONS, ecgConditionSchema } from "@/sim/content";
import { applyOverrides, computeBeat, DEFAULT_ECG_CONFIG, nodeVm } from "@/sim/cardiac-ep";
import { mechanicsAt } from "@/sim/cardiac-mech";
import { ECG_LEADS } from "@/sim/types";
import { activity, beatN, ecg, maxIn, minIn } from "./helpers";

const L = LEAD_INDEX;

describe("ECG test 1–4: normal sinus rhythm timing and intervals", () => {
  const e = ecg();
  it("1. produces a P wave before each conducted QRS (1:1)", () => {
    for (let i = 1; i < 8; i++) {
      const f = beatN(e, i).fiducials;
      expect(beatN(e, i).conductedToVentricles).toBe(true);
      expect(f.pOnsetMs).toBeLessThan(f.qrsOnsetMs!);
      expect(f.pEndMs).toBeLessThanOrEqual(f.qrsOnsetMs!);
    }
  });
  it("1b. the signal shows a P deflection that precedes the QRS deflection (limb leads)", () => {
    const f = beatN(e, 3).fiducials;
    const pAmp = Math.abs(maxIn(e, L.II, f.pOnsetMs, f.pEndMs + 20));
    expect(pAmp).toBeGreaterThan(0.05);
    expect(pAmp).toBeLessThan(0.4);
    // PR segment close to baseline
    const mid = (f.pEndMs + f.qrsOnsetMs!) / 2;
    expect(Math.abs(e.leadAt(L.II, mid))).toBeLessThan(0.05);
  });
  it("2. P-wave polarity matches the lead-vector convention (+ in I, II; − in aVR; biphasic V1)", () => {
    const f = beatN(e, 3).fiducials;
    expect(maxIn(e, L.I, f.pOnsetMs, f.pEndMs)).toBeGreaterThan(0.04);
    expect(minIn(e, L.I, f.pOnsetMs, f.pEndMs)).toBeGreaterThan(-0.03);
    expect(maxIn(e, L.II, f.pOnsetMs, f.pEndMs)).toBeGreaterThan(0.08);
    expect(minIn(e, L.aVR, f.pOnsetMs, f.pEndMs)).toBeLessThan(-0.05);
    expect(maxIn(e, L.aVR, f.pOnsetMs, f.pEndMs)).toBeLessThan(0.02);
    // V1 is biphasic: both a positive and a negative component
    expect(maxIn(e, L.V1, f.pOnsetMs, f.pEndMs + 20)).toBeGreaterThan(0.0);
    expect(minIn(e, L.V1, f.pOnsetMs, f.pEndMs + 20)).toBeLessThan(-0.03);
  });
  it("3. PR = QRS onset − P onset, and the signal agrees", () => {
    const b = beatN(e, 3);
    const m = measureBeat(b, beatN(e, 2), beatN(e, 2), "bazett");
    expect(m.prMs).toBeCloseTo(b.fiducials.qrsOnsetMs! - b.fiducials.pOnsetMs, 9);
    // signal-based: first time activity exceeds a small threshold after P onset − 30 and after QRS onset − 30
    const thr = 0.12;
    let tP = b.fiducials.pOnsetMs - 30; while (activity(e, tP) < thr && tP < b.fiducials.qrsOnsetMs!) tP += 1;
    let tQ = b.fiducials.pEndMs + 20; while (activity(e, tQ) < 0.25 && tQ < b.fiducials.qrsOnsetMs! + 60) tQ += 1;
    const sigPR = tQ - tP;
    expect(Math.abs(sigPR - m.prMs!)).toBeLessThan(45);
  });
  it("4. QRS duration = generated onset-to-offset (event-based and signal-based)", () => {
    const b = beatN(e, 3);
    const m = measureBeat(b, beatN(e, 2), beatN(e, 2), "bazett");
    expect(m.qrsMs).toBeCloseTo(b.fiducials.qrsEndMs! - b.fiducials.qrsOnsetMs!, 9);
    // after the J point the activity is low (ST segment) and before onset is low
    expect(activity(e, b.fiducials.qrsOnsetMs! - 5)).toBeLessThan(0.1);
    expect(activity(e, b.fiducials.qrsEndMs! + 25)).toBeLessThan(1.2);
    expect(m.qrsMs!).toBeGreaterThan(70); expect(m.qrsMs!).toBeLessThan(110);
  });
});

describe("ECG test 5: condition content has exactly 12 lead findings", () => {
  it.each(ECG_CONDITIONS.map((c) => [c.id, c] as const))("%s validates against the schema with 12 distinct leads", (_id, c) => {
    expect(c.leadFindings).toHaveLength(12);
    expect(new Set(c.leadFindings.map((l) => l.lead)).size).toBe(12);
    expect(c.leadFindings.map((l) => l.lead).sort()).toEqual([...ECG_LEADS].sort());
    expect(ecgConditionSchema.safeParse(c).success).toBe(true);
    expect(c.validation.status).not.toBe("validated"); // no named reviewer yet
  });
  it("rejects a condition with a missing lead", () => {
    const bad = { ...ECG_CONDITIONS[0], leadFindings: ECG_CONDITIONS[0].leadFindings.slice(0, 11) };
    expect(ecgConditionSchema.safeParse(bad).success).toBe(false);
  });
  it("every condition has a mechanistic preset", () => {
    for (const c of ECG_CONDITIONS) expect(ECG_PRESETS).toHaveProperty(c.id);
  });
});

describe("ECG test 6–7: bundle branch block alters the activation sequence", () => {
  const normal = ecg(); const lbbb = ecg(ECG_PRESETS.lbbb); const rbbb = ecg(ECG_PRESETS.rbbb);
  const ventEnd = (b: ReturnType<typeof beatN>, ids: string[]) => Math.max(...ids.map((i) => b.onset[i as "lvaEndo"]! - b.fiducials.qrsOnsetMs!));
  const LV = ["lvaEndo", "lvaEpi", "lvlEndo", "lvlEpi", "lviEndo", "lviEpi", "lvbEndo", "lvbEpi"];
  const RV = ["rvEndo", "rvEpi", "rvoEndo", "rvoEpi"];

  it("6. LBBB: the left bundle never activates, LV activation is delayed by >35 ms, the QRS is broad and RV activates first", () => {
    const n = beatN(normal, 3), b = beatN(lbbb, 3);
    expect(b.onset.leftBundle).toBeUndefined();
    expect(ventEnd(b, LV)).toBeGreaterThan(ventEnd(n, LV) + 35);
    expect(b.fiducials.qrsEndMs! - b.fiducials.qrsOnsetMs!).toBeGreaterThanOrEqual(120);
    expect(Math.min(...RV.map((i) => b.onset[i as "rvEndo"]!))).toBeLessThan(Math.min(...LV.map((i) => b.onset[i as "lvaEndo"]!)));
    // septum activated right-to-left: RV side before LV side
    expect(b.onset.sepR!).toBeLessThan(b.onset.sepL!);
    expect(n.onset.sepL!).toBeLessThan(n.onset.sepR!);
  });
  it("6b. LBBB morphology: V1 predominantly negative, broad R without q in I/V5/V6, secondary T discordance", () => {
    const b = beatN(lbbb, 3), f = b.fiducials, on = f.qrsOnsetMs!, end = f.qrsEndMs!, tEnd = f.tEndMs!;
    expect(minIn(lbbb, L.V1, on, end)).toBeLessThan(-Math.abs(maxIn(lbbb, L.V1, on, end)) * 2);
    for (const l of [L.I, L.V5, L.V6]) {
      expect(maxIn(lbbb, l, on, end)).toBeGreaterThan(0.4);
      expect(minIn(lbbb, l, on, end)).toBeGreaterThan(-0.06); // no septal q
      // T wave opposite to the main QRS deflection (inverted)
      expect(minIn(lbbb, l, end + 60, tEnd)).toBeLessThan(-0.1);
    }
    expect(maxIn(lbbb, L.V1, end + 60, tEnd)).toBeGreaterThan(0.2); // V1: upright T (discordant to negative QRS)
  });
  it("7. RBBB: right bundle never activates, terminal RV activation is delayed, QRS broad", () => {
    const n = beatN(normal, 3), b = beatN(rbbb, 3);
    expect(b.onset.rightBundle).toBeUndefined();
    const lastRvN = Math.max(...RV.map((i) => n.onset[i as "rvEndo"]!)) - n.fiducials.qrsOnsetMs!;
    const lastRvB = Math.max(...RV.map((i) => b.onset[i as "rvEndo"]!)) - b.fiducials.qrsOnsetMs!;
    expect(lastRvB).toBeGreaterThan(lastRvN + 40);
    expect(b.fiducials.qrsEndMs! - b.fiducials.qrsOnsetMs!).toBeGreaterThanOrEqual(120);
    // left ventricle still activates through normal pathways: same LV timing as normal
    expect(ventEnd(b, LV)).toBeCloseTo(ventEnd(n, LV), 6);
  });
  it("7b. RBBB morphology: V1 terminal R′ after an S, broad terminal S in lead I/V6", () => {
    const b = beatN(rbbb, 3), f = b.fiducials, on = f.qrsOnsetMs!, end = f.qrsEndMs!;
    // find the S nadir in V1, then require a positive deflection after it
    let tMin = on, vMin = Infinity;
    for (let t = on; t <= end; t += 5) { const v = rbbb.leadAt(L.V1, t); if (v < vMin) { vMin = v; tMin = t; } }
    expect(vMin).toBeLessThan(-0.4);
    expect(maxIn(rbbb, L.V1, tMin + 10, end + 10)).toBeGreaterThan(0.1);
    // terminal negative deflection in V6 and I after the R peak
    for (const l of [L.I, L.V6]) {
      let tMax = on, vMax = -Infinity;
      for (let t = on; t <= end; t += 5) { const v = rbbb.leadAt(l, t); if (v > vMax) { vMax = v; tMax = t; } }
      expect(minIn(rbbb, l, tMax + 5, end + 15)).toBeLessThan(-0.05);
    }
  });
});

describe("ECG test 8–10: AV conduction", () => {
  it("8. first-degree AV block prolongs PR without dropped beats", () => {
    const n = ecg(); const b = ecg(ECG_PRESETS["first-degree-av-block"]);
    const prN = measureBeat(beatN(n, 3), beatN(n, 2), beatN(n, 2), "bazett").prMs!;
    for (let i = 1; i < 10; i++) {
      expect(beatN(b, i).conductedToVentricles).toBe(true);
      expect(beatN(b, i).fiducials.qrsOnsetMs! - beatN(b, i).fiducials.pOnsetMs).toBeGreaterThan(200);
    }
    const prB = beatN(b, 3).fiducials.qrsOnsetMs! - beatN(b, 3).fiducials.pOnsetMs;
    expect(prB).toBeGreaterThan(prN + 50);
    // QRS unchanged
    expect(beatN(b, 3).fiducials.qrsEndMs! - beatN(b, 3).fiducials.qrsOnsetMs!).toBeCloseTo(beatN(n, 3).fiducials.qrsEndMs! - beatN(n, 3).fiducials.qrsOnsetMs!, 6);
  });
  it("9. Mobitz I progressively prolongs PR before a dropped QRS", () => {
    const e = ecg({ avBlock: { type: "mobitzI", incrementMs: 50, groupLength: 4 } });
    const beats = Array.from({ length: 12 }, (_, i) => beatN(e, i));
    const drops = beats.filter((b) => !b.conductedToVentricles);
    expect(drops.length).toBeGreaterThanOrEqual(2);
    for (let g = 0; g + 3 < beats.length; g += 4) {
      const prs = [0, 1, 2].map((k) => beats[g + k].fiducials.qrsOnsetMs! - beats[g + k].fiducials.pOnsetMs);
      expect(prs[1]).toBeGreaterThan(prs[0]); expect(prs[2]).toBeGreaterThan(prs[1]);
      expect(beats[g + 3].conductedToVentricles).toBe(false);
    }
    // the P wave of a dropped beat has no QRS after it
    expect(drops[0].fiducials.qrsOnsetMs).toBeUndefined();
  });
  it("10. Mobitz II drops a QRS without progressive PR prolongation", () => {
    const e = ecg({ avBlock: { type: "mobitzII", dropEvery: 4 } });
    const beats = Array.from({ length: 12 }, (_, i) => beatN(e, i));
    const conducted = beats.filter((b) => b.conductedToVentricles);
    expect(beats.length - conducted.length).toBeGreaterThanOrEqual(2);
    const prs = conducted.map((b) => b.fiducials.qrsOnsetMs! - b.fiducials.pOnsetMs);
    expect(Math.max(...prs) - Math.min(...prs)).toBeLessThan(1e-6);
  });
  it.todo("11. Complete heart block has independent atrial and ventricular schedules (not in phase 1: needs an escape-rhythm generator)");
  it.todo("12. AF has no organised repeating P waves (not in phase 1)");
  it.todo("13. Flutter produces organised atrial activity (not in phase 1)");
});

describe("ECG test 14: Einthoven relationships", () => {
  it("II = I + III, aVR + aVL + aVF = 0, aVR = −(I+II)/2 at every sample (normal and LBBB)", () => {
    for (const cfg of [{}, ECG_PRESETS.lbbb, ECG_PRESETS.rbbb]) {
      const e = ecg(cfg);
      for (let t = 1500; t < 4500; t += 10) {
        const s = e.sampleAll(t);
        expect(s[L.II]).toBeCloseTo(s[L.I] + s[L.III], 5);
        expect(s[L.aVR] + s[L.aVL] + s[L.aVF]).toBeCloseTo(0, 5);
        expect(s[L.aVR]).toBeCloseTo(-(s[L.I] + s[L.II]) / 2, 5);
      }
    }
  });
  it("precordial leads are not copies of limb leads (distinct waveforms)", () => {
    const e = ecg();
    const f = beatN(e, 3).fiducials;
    const v = (l: number) => Array.from({ length: 40 }, (_, k) => e.leadAt(l, f.qrsOnsetMs! + k * 3));
    expect(v(L.V1)).not.toEqual(v(L.II));
    expect(v(L.V1)).not.toEqual(v(L.V6));
    // transition: V1 net negative, V6 net positive
    const net = (l: number) => v(l).reduce((a, b) => a + b, 0);
    expect(net(L.V1)).toBeLessThan(0); expect(net(L.V6)).toBeGreaterThan(0);
  });
});

describe("ECG test 15: paper calibration", () => {
  it("25 mm/s and 10 mm/mV: small square 40 ms / 0.1 mV, large square 200 ms / 0.5 mV", () => {
    const c = { speedMmPerS: 25 as const, gainMmPerMv: 10 as const };
    expect(smallSquareMs(c)).toBeCloseTo(40); expect(largeSquareMs(c)).toBeCloseTo(200);
    expect(smallSquareMv(c)).toBeCloseTo(0.1); expect(largeSquareMv(c)).toBeCloseTo(0.5);
  });
  it("50 mm/s: 20 ms / 100 ms; 5 and 20 mm/mV scale the voltage squares", () => {
    const c50 = { speedMmPerS: 50 as const, gainMmPerMv: 10 as const };
    expect(smallSquareMs(c50)).toBeCloseTo(20); expect(largeSquareMs(c50)).toBeCloseTo(100);
    expect(smallSquareMv({ speedMmPerS: 25, gainMmPerMv: 5 })).toBeCloseTo(0.2);
    expect(largeSquareMv({ speedMmPerS: 25, gainMmPerMv: 20 })).toBeCloseTo(0.25);
  });
});

describe("ECG test 16: reset and replay reproduce identical signals", () => {
  it("same config → bit-identical samples; reset → identical again; replay with logged input → identical", () => {
    const sample = (e: EcgEngine) => Array.from({ length: 12 }, (_, l) => Array.from(e.leadWindow(l, 1000, 400)));
    const a = new EcgEngine(), b = new EcgEngine();
    expect(sample(a)).toEqual(sample(b));
    const first = sample(a);
    a.step(5); a.reset();
    expect(sample(a)).toEqual(first);

    const runner = new SimulationRunner<ReturnType<EcgEngine["snapshot"]>, Parameters<EcgEngine["apply"]>[0]>(new EcgEngine(), { snapshotEveryMs: 250 });
    runner.stepForward(200);                                   // t = 1000
    runner.dispatch({ type: "setConfig", patch: { sinusRateBpm: 110 } });
    runner.stepForward(400);                                   // t = 3000
    const eng = runner.engine as EcgEngine;
    const live = Array.from({ length: 12 }, (_, l) => Array.from(eng.leadWindow(l, 1000, 400)));
    runner.replay(3000);
    const replayed = Array.from({ length: 12 }, (_, l) => Array.from(eng.leadWindow(l, 1000, 400)));
    expect(replayed).toEqual(live);
    runner.seek(1500);                                         // step back
    runner.seek(3000);
    expect(Array.from({ length: 12 }, (_, l) => Array.from(eng.leadWindow(l, 1000, 400)))).toEqual(live);
  });
});

describe("Conduction engine: blocks must stop or delay propagation (spec §10)", () => {
  it("disabled edge: nothing downstream is activated through it", () => {
    const cfg = { ...DEFAULT_ECG_CONFIG, edgeOverrides: { "avNode->hisBundle": { enabled: false } } };
    const b = computeBeat(cfg, 0, 100, 92, null, applyOverrides(cfg));
    expect(b.conductedToVentricles).toBe(false);
    expect(b.onset.hisBundle).toBeUndefined();
    expect(b.onset.avNode).toBeDefined();
    expect(b.transits.find((t) => t.edgeId === "avNode->hisBundle")?.blocked).toBe(true);
  });
  it("conductionFactor < 1 delays propagation proportionally", () => {
    const base = computeBeat(DEFAULT_ECG_CONFIG, 0, 0, 92, null);
    const slow = computeBeat({ ...DEFAULT_ECG_CONFIG, edgeOverrides: { "hisBundle->rightBundle": { conductionFactor: 0.5 } } }, 0, 0, 92, null,
      applyOverrides({ ...DEFAULT_ECG_CONFIG, edgeOverrides: { "hisBundle->rightBundle": { conductionFactor: 0.5 } } }));
    expect(slow.onset.rightBundle! - base.onset.rightBundle!).toBeCloseTo(12, 6); // 12 → 24 ms
  });
  it("the AV nodal delay parameter sets the PR interval one-to-one", () => {
    const pr = (d: number) => { const b = computeBeat({ ...DEFAULT_ECG_CONFIG, avNodalDelayMs: d }, 0, 0, d, null); return b.fiducials.qrsOnsetMs! - b.fiducials.pOnsetMs; };
    expect(pr(150) - pr(100)).toBeCloseTo(50, 6);
  });
});

describe("Intervals, QT and rate behaviour", () => {
  it("Bazett and Fridericia formulas", () => {
    expect(bazett(400, 1000)).toBeCloseTo(400); expect(fridericia(400, 1000)).toBeCloseTo(400);
    expect(bazett(360, 800)).toBeCloseTo(360 / Math.sqrt(0.8)); expect(fridericia(360, 800)).toBeCloseTo(360 / Math.cbrt(0.8));
  });
  it("QT shortens with rate (≈ √RR) so Bazett QTc stays within ±10 % between 50 and 110/min", () => {
    const qtc = (rate: number) => measurementsAt(ecg({ sinusRateBpm: rate }), 6000)!;
    const slow = qtc(50), mid = qtc(72), fast = qtc(110);
    expect(slow.qtMs!).toBeGreaterThan(mid.qtMs!); expect(mid.qtMs!).toBeGreaterThan(fast.qtMs!);
    for (const m of [slow, fast]) expect(Math.abs(m.qtcBazettMs! / mid.qtcBazettMs! - 1)).toBeLessThan(0.1);
    expect(fast.qtcFridericiaMs!).not.toBeCloseTo(fast.qtcBazettMs!, 0);
  });
  it("RR, PP and heart rate follow the set sinus rate", () => {
    const m = measurementsAt(ecg({ sinusRateBpm: 90 }), 5000)!;
    expect(m.rrMs!).toBeCloseTo(60000 / 90, 3); expect(m.ppMs!).toBeCloseTo(60000 / 90, 3); expect(m.heartRateBpm!).toBeCloseTo(90, 3);
  });
  it("normal axis lies in the −30°..+90° range and T wave is upright in II and V5", () => {
    const e = ecg(); const b = beatN(e, 3);
    const ax = frontalQrsAxisDeg(e, b)!;
    expect(ax).toBeGreaterThan(-30); expect(ax).toBeLessThan(90);
    expect(maxIn(e, L.II, b.fiducials.qrsEndMs! + 60, b.fiducials.tEndMs!)).toBeGreaterThan(0.15);
    expect(maxIn(e, L.V5, b.fiducials.qrsEndMs! + 60, b.fiducials.tEndMs!)).toBeGreaterThan(0.15);
  });
  it("sinus arrhythmia modulates RR deterministically", () => {
    const m = ecg({ sinusVariabilityPct: 10 });
    const rr = Array.from({ length: 8 }, (_, i) => beatN(m, i + 1).saMs - beatN(m, i).saMs);
    expect(Math.max(...rr) - Math.min(...rr)).toBeGreaterThan(20);
    const m2 = ecg({ sinusVariabilityPct: 10 });
    expect(Array.from({ length: 8 }, (_, i) => beatN(m2, i + 1).saMs - beatN(m2, i).saMs)).toEqual(rr);
  });
  it("changing a setting only affects beats that have not yet fired", () => {
    const e = new EcgEngine();
    e.step(2000); e.timeMs = 2000;
    const inFlight = e.beats.filter((b) => b.ep.saMs <= 2000).map((b) => b.ep.saMs);
    e.apply({ type: "setConfig", patch: { sinusRateBpm: 150 } });
    expect(e.beats.filter((b) => b.ep.saMs <= 2000).map((b) => b.ep.saMs)).toEqual(inFlight);
    const next = e.beats.find((b) => b.ep.saMs > 2000)!;
    expect(next.ep.saMs).toBeGreaterThan(2000);
  });
});

describe("Cardiac mechanics follow electrical activation (spec §15)", () => {
  const e = ecg(); const b = beatN(e, 3); const f = b.fiducials;
  it("ventricular contraction starts after the QRS onset (electromechanical delay) and atrial/ventricular events are distinct", () => {
    const beats = e.beatsNear(f.qrsOnsetMs! + 400);
    const v = (t: number) => mechanicsAt(beats, t).ventricular;
    const a = (t: number) => mechanicsAt(beats, t).atrial;
    expect(v(f.qrsOnsetMs! - 5)).toBeLessThan(0.01);
    expect(v(f.qrsOnsetMs! + 10)).toBeLessThan(0.02);       // EMD: little force 10 ms after QRS onset
    expect(v(f.qrsEndMs! + 120)).toBeGreaterThan(0.6);
    // atrial contraction precedes ventricular contraction
    let tA = f.pOnsetMs; while (a(tA) < 0.5 && tA < f.qrsOnsetMs! + 300) tA += 5;
    let tV = f.qrsOnsetMs!; while (v(tV) < 0.5 && tV < f.qrsOnsetMs! + 400) tV += 5;
    expect(tA).toBeLessThan(tV);
    // not the whole heart squeezing at the R peak: at QRS end the septum leads the postero-basal wall
    const m = mechanicsAt(beats, f.qrsOnsetMs! + 70);
    expect(m.nodes.sepL).toBeGreaterThan(m.nodes.lvbEpi);
  });
  it("LBBB delays LV contraction relative to the RV", () => {
    const l = ecg(ECG_PRESETS.lbbb); const bl = beatN(l, 3);
    const beats = l.beatsNear(bl.fiducials.qrsOnsetMs! + 400);
    const t = bl.fiducials.qrsOnsetMs! + 80;
    const m = mechanicsAt(beats, t);
    expect(m.rightVentricle).toBeGreaterThan(m.leftVentricle);
  });
  it("valves and phases are consistent (ejection only while ventricular force is high)", () => {
    const beats = e.beatsNear(f.qrsOnsetMs! + 400);
    const m = mechanicsAt(beats, f.qrsEndMs! + 100);
    expect(m.phase).toBe("Ventricular ejection");
    expect(m.valves.aortic).toBe("open"); expect(m.valves.mitral).toBe("closed");
    const d = mechanicsAt(beats, f.tEndMs! + 250);
    expect(d.valves.mitral).toBe("open"); expect(d.valves.aortic).toBe("closed");
  });
});

describe("Model structure", () => {
  it("vm is bounded 0..1 and dipole pairs reference existing nodes", () => {
    const b = beatN(ecg(), 3);
    for (const d of DIPOLE_PAIRS) for (let t = b.saMs; t < b.saMs + 600; t += 20) { const v = nodeVm(b, d.a, t); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1.0000001); }
  });
});
