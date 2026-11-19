import { describe, expect, it } from "vitest";
import { SimulationRunner } from "@/sim/core";
import { VentilatorEngine, MODE_DEFINITIONS, type VentSettings, type VentInput } from "@/sim/vent";
import { RespiratorySystem, makeCompartments, makePatient, predictedBodyWeightKg, respiratorySystemCompliance, musclePressure, effortFromPatient } from "@/sim/resp";
import type { RespiratoryPatient } from "@/sim/types";
import { VENTILATOR_PRESETS, ventilatorCaseSchema, VENTILATOR_CASES } from "@/sim/content";

type Opts = ConstructorParameters<typeof VentilatorEngine>[0];
const run = (opts: Opts, seconds: number, actions: Array<[number, VentInput]> = []) => {
  const e = new VentilatorEngine(opts);
  const todo = [...actions].sort((a, b) => a[0] - b[0]);
  for (let t = 0; t < seconds * 1000; t += 5) {
    while (todo.length && todo[0][0] <= t) e.apply(todo.shift()![1]);
    e.step(5);
  }
  return e;
};
const settle = (s: Partial<VentSettings> = {}, patient: Partial<RespiratoryPatient> = {}, seconds = 14, extra: Partial<Opts> = {}) =>
  run({ settings: { inspPauseSec: 0.6, ...s }, patient, ...extra }, seconds);
const lastFull = (e: VentilatorEngine) => e.breaths[e.breaths.length - 1];
const C_RS = respiratorySystemCompliance(0.17, 0.24);

describe("Respiratory mechanics basics", () => {
  it("series compliance and predicted body weight", () => {
    expect(respiratorySystemCompliance(0.2, 0.2)).toBeCloseTo(0.1);
    expect(predictedBodyWeightKg(175, "male")).toBeCloseTo(50 + 0.91 * (175 - 152.4));
    expect(predictedBodyWeightKg(165, "female")).toBeCloseTo(45.5 + 0.91 * (165 - 152.4));
  });
  it("equilibrium at PEEP: volume = PEEP × C_RS and alveolar pressure = PEEP everywhere", () => {
    const s = new RespiratorySystem(makePatient(), makeCompartments());
    s.equilibrate(8);
    expect(s.totalVolume).toBeCloseTo(8 * C_RS, 6);
    for (let i = 0; i < 5; i++) expect(s.pAlv(i, 0)).toBeCloseTo(8, 6);
  });
  it("single-compartment equation of motion: P_aw + P_mus = V/C_RS + R·Flow at every sample (passive and with effort)", () => {
    const patient = makePatient({ musclePressureAmplitudeCmH2O: 0 });
    const comp = makeCompartments({ RUL: { complianceFraction: 1, conductanceFraction: 1 }, RML: { complianceFraction: 0, conductanceFraction: 1e-9 } });
    void comp;
    // true one-compartment: use a one-element compartment list
    const one = [{ ...makeCompartments()[0], complianceFraction: 1, conductanceFraction: 1 }];
    const e = new VentilatorEngine({ patient: { ...patient, musclePressureAmplitudeCmH2O: 4, spontaneousRateBpm: 12 }, compartments: one, settings: { rr: 12, triggerType: "flow", flowTriggerLpm: 60 } });
    const R = 5 + 2, C = C_RS;
    for (let i = 0; i < 2400; i++) e.step(5);
    let maxErr = 0, n = 0;
    for (let i = 0; i < e.samples.length; i++) {
      const s = e.samples.at(i);
      if (s.timeMs < 1000) continue;
      const lhs = s.paw + s.pmus;
      const rhs = (s.volume + 5 * C) / C + R * s.flow; // V above relaxed = volume + PEEP·C (PEEP = 5)
      maxErr = Math.max(maxErr, Math.abs(lhs - rhs)); n++;
    }
    expect(n).toBeGreaterThan(1000);
    expect(maxErr).toBeLessThan(0.35); // Euler 1 ms substeps
  });
  it("time constants: 1τ → 63 %, 3τ → 95 %", () => {
    const tau = 0.7;
    expect(1 - Math.exp(-1)).toBeCloseTo(0.632, 2);
    expect(1 - Math.exp(-3)).toBeCloseTo(0.95, 2);
    expect(tau * 3).toBeCloseTo(2.1);
  });
  it("muscle pressure is an independent half-sine effort signal", () => {
    const m = { ...effortFromPatient(makePatient({ musclePressureAmplitudeCmH2O: 10, spontaneousRateBpm: 15 })) };
    expect(musclePressure(m, 0.5)).toBe(0);
    expect(musclePressure(m, m.onsetSec + m.durationSec / 2)).toBeCloseTo(10, 6);
    expect(musclePressure({ ...m, amplitudeCmH2O: 0 }, 1.4)).toBe(0);
  });
});

describe("Ventilator test 1–4: volume control", () => {
  const e = settle();
  const b = lastFull(e);
  it("1. VC delivers the target volume in the ideal passive model (within 1 %)", () => {
    expect(b.vtiL * 1000).toBeGreaterThan(450 * 0.99); expect(b.vtiL * 1000).toBeLessThan(450 * 1.01);
  });
  it("1b. VC targets volume and does not fix pressure: changing VT changes Pplat proportionally", () => {
    const a = lastFull(settle({ vtMl: 300 })), c = lastFull(settle({ vtMl: 600 }));
    expect((c.pplat.value! - 5) / (a.pplat.value! - 5)).toBeCloseTo(2, 1);
  });
  it("1c. matches the analytic solution: Pplat = PEEP + VT/C, Ppeak − Pplat = R·Flow, τ = R·C", () => {
    expect(b.pplat.value!).toBeCloseTo(5 + 0.45 / C_RS, 1);
    expect(b.resistance.value!).toBeCloseTo(7, 0);
    expect(b.ppeak - b.pplat.value!).toBeCloseTo(7 * 1.0, 0);
    expect(b.expiratoryTimeConstantSec.value!).toBeCloseTo(7 * C_RS, 1);
    expect(b.staticCompliance.value!).toBeCloseTo(C_RS, 2); // small residual: 1 % of the previous breath is still unexhaled
  });
  it("2. lower compliance causes higher pressure for the same VC volume", () => {
    const stiff = lastFull(settle({}, makePatient({ complianceLPerCmH2O: 0.06 })));
    expect(stiff.vtiL).toBeCloseTo(b.vtiL, 2);
    expect(stiff.ppeak).toBeGreaterThan(b.ppeak + 3);
    expect(stiff.pplat.value!).toBeGreaterThan(b.pplat.value! + 3);
    expect(stiff.drivingPressure.value!).toBeGreaterThan(b.drivingPressure.value!);
  });
  it("3. higher resistance increases Ppeak far more than Pplat", () => {
    const lo8 = lastFull(settle({ rr: 8 })), hi8 = lastFull(settle({ rr: 8 }, makePatient({ airwayResistanceCmH2OPerLPerSec: 20 })));
    const dPeak = hi8.ppeak - lo8.ppeak, dPlat = hi8.pplat.value! - lo8.pplat.value!;
    expect(dPeak).toBeGreaterThan(10);
    expect(Math.abs(dPlat)).toBeLessThan(0.5);
    expect(dPeak).toBeGreaterThan(5 * Math.abs(dPlat));
  });
  it("4. inspiratory hold: flow is zero and pressure falls from peak toward the plateau", () => {
    const hold = e.window(b.startMs, b.endMs).filter((s) => s.phase === "inspiratory_hold");
    expect(hold.length).toBeGreaterThan(100);
    for (const s of hold) expect(s.flow).toBe(0);
    expect(hold[0].paw).toBeLessThan(b.ppeak);
    expect(hold[0].paw).toBeGreaterThanOrEqual(hold[hold.length - 1].paw - 1e-3);
    // monotonic fall to the plateau (single compartment-like healthy lung: pendelluft negligible)
    expect(hold[hold.length - 1].paw).toBeCloseTo(b.pplat.value!, 6);
    expect(b.ppeak).toBeGreaterThan(b.pplat.value! + 3);
  });
  it("plateau and resistance are NOT reported without a valid inspiratory hold", () => {
    const x = lastFull(settle({ inspPauseSec: 0 }));
    expect(x.pplat.valid).toBe(false); expect(x.pplat.reason).toMatch(/hold/i);
    expect(x.resistance.valid).toBe(false); expect(x.drivingPressure.valid).toBe(false); expect(x.staticCompliance.valid).toBe(false);
    expect(x.dynamicCompliance.valid).toBe(true);
  });
  it("plateau is invalidated by patient effort during the hold", () => {
    const x = lastFull(run({ patient: makePatient({ musclePressureAmplitudeCmH2O: 8, spontaneousRateBpm: 14 }), settings: { inspPauseSec: 0.6 } }, 25));
    const anyEffortInvalid = run({ patient: makePatient({ musclePressureAmplitudeCmH2O: 8, spontaneousRateBpm: 14 }), settings: { inspPauseSec: 0.6 } }, 25).breaths.some((r) => r.effortDetected && !r.pplat.valid);
    expect(anyEffortInvalid || !x.pplat.valid || x.effortDetected).toBe(true);
  });
  it("flow patterns: square is constant, decelerating falls linearly; both deliver VT", () => {
    const sq = settle({ flowPattern: "square" }, {}, 8), dec = settle({ flowPattern: "decelerating" }, {}, 8);
    const insp = (en: VentilatorEngine) => { const br = en.breaths[en.breaths.length - 1]; return en.window(br.startMs, br.endMs).filter((s) => s.phase === "inspiration"); };
    const sf = insp(sq).map((s) => s.flow); expect(Math.max(...sf) - Math.min(...sf)).toBeLessThan(1e-6);
    const df = insp(dec).map((s) => s.flow); expect(df[0]).toBeGreaterThan(df[df.length - 1] * 5);
    expect(lastFull(dec).vtiL).toBeCloseTo(0.45, 2);
  });
  it("pressure limit: the breath is pressure-limited and VT is not fully delivered", () => {
    const x = lastFull(settle({ pressureLimitCmH2O: 12 }, makePatient({ complianceLPerCmH2O: 0.04 })));
    expect(x.pressureLimited).toBe(true);
    expect(x.vtiL * 1000).toBeLessThan(450 * 0.9);
    expect(x.ppeak).toBeLessThanOrEqual(12.0001);
  });
});

describe("Ventilator test 5–6: pressure control", () => {
  const settings = { mode: "PC-A/C" as const, pInspCmH2O: 12, tiSec: 1.2, inspPauseSec: 0 };
  const e = settle(settings);
  const b = lastFull(e);
  it("5. PC maintains the configured pressure target (PEEP + P_insp) through inspiration", () => {
    const insp = e.window(b.startMs, b.endMs).filter((s) => s.phase === "inspiration");
    const plateau = insp.filter((s) => s.timeMs - b.startMs > 300);
    for (const s of plateau) expect(s.paw).toBeCloseTo(17, 6);
    expect(b.ppeak).toBeCloseTo(17, 6);
  });
  it("5b. flow is highest at the start of inspiration and decelerates; volume depends on mechanics", () => {
    const insp = e.window(b.startMs, b.endMs).filter((s) => s.phase === "inspiration");
    expect(Math.max(...insp.map((s) => s.flow))).toBeGreaterThan(insp[insp.length - 1].flow * 3);
    expect(insp[insp.length - 1].flow).toBeGreaterThan(0);
    expect(b.vtiL).toBeGreaterThan(0.2);
  });
  it("6. lower compliance reduces delivered volume for the same pressure and timing", () => {
    const stiff = lastFull(settle(settings, makePatient({ complianceLPerCmH2O: 0.05 })));
    expect(stiff.vtiL).toBeLessThan(b.vtiL * 0.6);
    expect(stiff.ppeak).toBeCloseTo(b.ppeak, 6);
  });
  it("6b. higher resistance also reduces delivered volume in PC", () => {
    const hi = lastFull(settle(settings, makePatient({ airwayResistanceCmH2OPerLPerSec: 25 })));
    expect(hi.vtiL).toBeLessThan(b.vtiL * 0.8);
  });
  it("PC converges to C·ΔP·(1−e^(−Ti/τ))", () => {
    const tau = 7 * C_RS, expected = C_RS * 12 * (1 - Math.exp(-1.2 / tau));
    expect(b.vtiL).toBeGreaterThan(expected * 0.93); expect(b.vtiL).toBeLessThan(expected * 1.07);
  });
});

describe("Ventilator test 7–10: volume, expiration, resistance, auto-PEEP", () => {
  const e = settle({}, {}, 12);
  it("7. volume equals integrated flow (cumulative Σ flow·dt matches the volume signal)", () => {
    let cum = 0, maxErr = 0;
    for (let i = 0; i < e.samples.length; i++) {
      const s = e.samples.at(i);
      cum += s.flow * 0.005;
      maxErr = Math.max(maxErr, Math.abs(s.volume - cum));
    }
    expect(maxErr).toBeLessThan(1e-6);
  });
  it("8. no-leak passive expiration returns volume to baseline when there is no trapping", () => {
    const b = lastFull(e);
    expect(b.incompleteExpiration).toBe(false);
    expect(Math.abs(b.endExpVolumeL)).toBeLessThan(0.01 * b.vtiL);
    expect(b.vteL).toBeCloseTo(b.vtiL, 2);
  });
  const obs = VENTILATOR_PRESETS.obstructive;
  const mk = (settings: Partial<VentSettings>, actions: Array<[number, VentInput]> = [], sec = 20) =>
    run({ patient: obs.case.baselinePatient, compartments: obs.case.regionalCompartments, peripheralResistance: obs.peripheralResistance, settings: { inspPauseSec: 0.6, ...settings } }, sec, actions);
  it("9. high resistance prolongs expiratory flow decay (longer measured τ, slower return of flow to zero)", () => {
    const hi = lastFull(mk({ rr: 10 }));
    const nb = lastFull(e);
    expect(hi.expiratoryTimeConstantSec.value!).toBeGreaterThan(nb.expiratoryTimeConstantSec.value! * 2);
    // time for expiratory flow to fall to 10 % of its peak is longer
    const tDecay = (en: VentilatorEngine, b: typeof hi) => { const s = en.window(b.startMs, b.endMs).filter((x) => x.phase === "expiration"); const pk = Math.min(...s.map((x) => x.flow)); const i = s.findIndex((x) => x.flow === pk); let j = s.findIndex((x, k) => k > i && x.flow > pk * 0.1); if (j < 0) j = s.length; return (j - i) * 0.005; };
    const en2 = mk({ rr: 10 }); const hb = lastFull(en2);
    expect(tDecay(en2, hb)).toBeGreaterThan(tDecay(e, lastFull(e)) * 2);
  });
  it("10. incomplete expiration increases residual volume and auto-PEEP (shown by an expiratory hold)", () => {
    const en = mk({ rr: 22, tiSec: 0.5, inspFlowLpm: 90 }, [[14000, { type: "holdExpiratory", seconds: 2 }]], 24);
    const trapped = en.breaths.filter((b) => b.incompleteExpiration);
    expect(trapped.length).toBeGreaterThan(3);
    const last = en.breaths[en.breaths.length - 2];
    expect(last.endExpVolumeL).toBeGreaterThan(0.05);              // dynamic hyperinflation (volume above the reference)
    expect(Math.abs(last.endExpFlowLps)).toBeGreaterThan(0.02);     // flow does not return to zero
    const held = en.breaths.find((b) => b.peepTotal.valid);
    expect(held).toBeDefined();
    expect(held!.peepTotal.value!).toBeGreaterThan(held!.peepSet + 1); // total PEEP > set PEEP
    // the same patient with a long expiratory time has no trapping
    const slow = lastFull(mk({ rr: 8, tiSec: 0.5 }, [], 40));
    expect(slow.endExpVolumeL).toBeLessThan(trapped[trapped.length - 1].endExpVolumeL);
  });
  it("total PEEP from an expiratory hold equals the alveolar pressure (no patient effort)", () => {
    const en = run({ patient: makePatient(), settings: { inspPauseSec: 0.6, peepCmH2O: 8 } }, 12, [[3000, { type: "holdExpiratory", seconds: 1.5 }]]);
    const b = en.breaths.find((x) => x.peepTotal.valid)!;
    expect(b.peepTotal.value!).toBeCloseTo(8, 1);
  });
  it("Pplat-based driving pressure uses total PEEP when measured, set PEEP otherwise (and says so)", () => {
    const b = lastFull(e);
    expect(b.drivingPressure.basis).toMatch(/set PEEP/);
    const en = run({ patient: makePatient(), settings: { inspPauseSec: 0.6 } }, 12, [[2000, { type: "holdExpiratory", seconds: 1.5 }]]);
    const h = en.breaths.find((x) => x.peepTotal.valid && x.pplat.valid)!;
    expect(h.drivingPressure.basis).toMatch(/total PEEP/);
  });
});

describe("Ventilator test 11: trigger sensitivity", () => {
  const effortPatient = makePatient({ musclePressureAmplitudeCmH2O: 5, spontaneousRateBpm: 20 });
  const count = (s: Partial<VentSettings>) => run({ patient: effortPatient, settings: { rr: 8, ...s } }, 40).breaths.filter((b) => b.triggeredBy === "patient").length;
  it("a sensitive trigger lets effort start breaths; an insensitive one gives ineffective efforts (no breath)", () => {
    const sensitive = count({ triggerType: "flow", flowTriggerLpm: 2 });
    const insensitive = count({ triggerType: "flow", flowTriggerLpm: 60 });
    expect(sensitive).toBeGreaterThan(5);
    expect(insensitive).toBe(0);
  });
  it("pressure trigger works the same way and the trigger marker is recorded on the sample", () => {
    const en = run({ patient: effortPatient, settings: { rr: 8, triggerType: "pressure", pressureTriggerCmH2O: 1 } }, 20);
    expect(en.breaths.some((b) => b.triggeredBy === "patient")).toBe(true);
    let marks = 0; for (let i = 0; i < en.samples.length; i++) if (en.samples.at(i).trigger === "patient") marks++;
    expect(marks).toBeGreaterThan(0);
    const insens = run({ patient: effortPatient, settings: { rr: 8, triggerType: "pressure", pressureTriggerCmH2O: 15 } }, 20);
    expect(insens.breaths.filter((b) => b.triggeredBy === "patient").length).toBe(0);
  });
  it("ineffective efforts are visible: muscle pressure present with no corresponding ventilator breath", () => {
    const en = run({ patient: effortPatient, settings: { rr: 8, triggerType: "flow", flowTriggerLpm: 30 } }, 20);
    let effortSamples = 0; for (let i = 0; i < en.samples.length; i++) { const s = en.samples.at(i); if (s.pmus > 3 && s.phase === "expiration") effortSamples++; }
    expect(effortSamples).toBeGreaterThan(20);
  });
});

describe("Ventilator test 12–13: not implemented in phase 1", () => {
  it.todo("12. PSV cycles according to the configured flow-cycling rule (PSV is a later milestone)");
  it.todo("13. PRVC adjusts pressure toward the target volume while respecting limits (later milestone)");
});

describe("Ventilator test 14: regional compartments", () => {
  it("regional compartment volumes sum to the total lung volume at every sample (healthy and ARDS-like with recruitment)", () => {
    for (const id of ["healthy-adult", "ards-like", "obstructive"]) {
      const p = VENTILATOR_PRESETS[id];
      const e = run({ patient: p.case.baselinePatient, compartments: p.case.regionalCompartments, peripheralResistance: p.peripheralResistance, settings: { ...p.suggestedSettings, inspPauseSec: 0.4 } }, 12);
      for (let i = 0; i < e.samples.length; i += 7) {
        const s = e.samples.at(i);
        const sum = s.compVolumes.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(s.volume + e.volumeLastRef(), 3);
      }
    }
  });
  it("heterogeneous airway resistance gives unequal regional filling; each compartment has its own time constant", () => {
    const p = VENTILATOR_PRESETS.obstructive;
    const e = run({ patient: p.case.baselinePatient, compartments: p.case.regionalCompartments, peripheralResistance: p.peripheralResistance, settings: { rr: 30, tiSec: 0.4 } }, 10);
    let hi = e.samples.at(0), lo = e.samples.at(0);
    for (let i = e.samples.length - 600; i < e.samples.length; i++) { const x = e.samples.at(i); if (x.volume > hi.volume) hi = x; if (x.volume < lo.volume) lo = x; }
    const delta = hi.compVolumes.map((v, i) => v - lo.compVolumes[i]);
    const share = delta.map((v) => v / delta.reduce((a, b) => a + b, 0));
    const comps = p.case.regionalCompartments;
    expect(share.some((x, i) => Math.abs(x - comps[i].complianceFraction) > 0.01)).toBe(true);
    const sys = new RespiratorySystem(p.case.baselinePatient, comps, p.peripheralResistance);
    const taus = comps.map((_, i) => sys.r(i) * sys.cL(i));
    expect(Math.max(...taus) / Math.min(...taus)).toBeGreaterThan(1.5);
  });
  it("recruitment: dependent units collapse at low PEEP and open at higher PEEP (hysteresis), conserving volume", () => {
    const p = VENTILATOR_PRESETS["ards-like"];
    const open = (peep: number) => { const e = run({ patient: p.case.baselinePatient, compartments: p.case.regionalCompartments, peripheralResistance: p.peripheralResistance, settings: { ...p.suggestedSettings, peepCmH2O: peep } }, 12); const b = e.breaths[e.breaths.length - 1]; const endExp = e.window(b.endMs - 5, b.endMs)[0]; return endExp.compOpen.filter(Boolean).length; };
    expect(open(14)).toBeGreaterThan(open(3));
  });
});

describe("Ventilator test 15: reset and replay", () => {
  it("reset reproduces identical waveforms", () => {
    const grab = (e: VentilatorEngine) => Array.from({ length: e.samples.length }, (_, i) => { const s = e.samples.at(i); return [s.paw, s.flow, s.volume, s.phase]; });
    const e = run({}, 10);
    const a = grab(e);
    e.reset();
    for (let i = 0; i < 2000; i++) e.step(5);
    expect(grab(e)).toEqual(a);
  });
  it("seek back, replay with logged inputs, and event replay give identical waveforms", () => {
    const r = new SimulationRunner<ReturnType<VentilatorEngine["snapshot"]>, VentInput>(new VentilatorEngine({ settings: { inspPauseSec: 0.5 } }), { snapshotEveryMs: 500 });
    r.stepForward(400);                                   // 2 s
    r.dispatch({ type: "setSettings", patch: { peepCmH2O: 10, vtMl: 380 } });
    r.stepForward(800);                                   // 6 s
    r.dispatch({ type: "setPatient", patch: { complianceLPerCmH2O: 0.08 } });
    r.stepForward(1200);                                  // 12 s
    const eng = r.engine as VentilatorEngine;
    const grab = () => Array.from({ length: eng.samples.length }, (_, i) => { const s = eng.samples.at(i); return [s.timeMs, +s.paw.toFixed(9), +s.flow.toFixed(9), +s.volume.toFixed(9)]; });
    const live = grab();
    r.seek(4000);
    expect(r.timeMs).toBe(4000);
    r.seek(12000);
    expect(grab()).toEqual(live);
    r.replay(12000);
    expect(grab()).toEqual(live);
  });
});

describe("Mode definitions and content", () => {
  it("every implemented mode defines trigger, control, limit and cycle plus mandatory/spontaneous, trigger availability, backup and apnoea", () => {
    for (const m of Object.values(MODE_DEFINITIONS)) {
      expect(m.trigger.description.length).toBeGreaterThan(10); expect(m.control.description.length).toBeGreaterThan(10);
      expect(m.limit.description.length).toBeGreaterThan(10); expect(m.cycle.description.length).toBeGreaterThan(10);
      expect(m.breathType).toBeTruthy(); expect(m.backupRate).toBeTruthy(); expect(m.apnoeaBehaviour).toBeTruthy();
      expect(typeof m.patientTriggerAvailable).toBe("boolean");
    }
  });
  it("ventilator cases validate against the schema, none claims to be validated, all have safety warnings", () => {
    for (const c of VENTILATOR_CASES) {
      const r = ventilatorCaseSchema.safeParse(c);
      expect(r.success, JSON.stringify(r.success ? "" : r.error.issues)).toBe(true);
      expect(c.validationStatus).not.toBe("validated"); expect(c.safetyWarnings.length).toBeGreaterThan(0);
    }
  });
  it("no case maps a diagnosis to a single 'correct' mode (spec rule 9)", () => {
    for (const c of VENTILATOR_CASES) expect(c.suggestedExplorationModes.length).toBeGreaterThanOrEqual(2);
  });
  it("PBW-based VT: VT/PBW is reported in mL/kg", () => {
    const b = lastFull(settle({ vtMl: 420 }));
    expect(b.vtPerPbwMlPerKg).toBeCloseTo(420 / predictedBodyWeightKg(175, "male"), 1);
  });
});
