import { describe, expect, it } from "vitest";
import { SimulationRunner } from "@/sim/core";
import { VentilatorEngine, apiSettingsPatch, caseInput, lobeExpansionInput, lungModeInputs, lungVisual, parseIeRatio, DEFAULT_VENT_SETTINGS, LUNG_MODES, type VentInput, type VentSnapshot } from "@/sim/vent";
import { LOBE_IDS, lobarShuntFraction, makeCompartments, makePatient, RespiratorySystem } from "@/sim/resp";
import { computeGasExchange } from "@/sim/gas";

const engineWith = (inputs: VentInput[], seconds = 30) => {
  const e = new VentilatorEngine({});
  for (const i of inputs) e.apply(i);
  for (let t = 0; t < seconds * 1000; t += 5) e.step(5);
  return e;
};
const lastBreathWithHold = (e: VentilatorEngine) => { e.apply({ type: "holdInspiratory", seconds: 0.6 }); for (let t = 0; t < 8000; t += 5) e.step(5); return [...e.breaths].reverse().find((b) => b.pplat.valid)!; };
const vtOf = (e: VentilatorEngine) => e.breaths[e.breaths.length - 2].vtiL;

describe("five-lobe model", () => {
  it("has five lobes whose compliance and conductance fractions sum to 1", () => {
    const c = makeCompartments();
    expect(c.map((x) => x.id)).toEqual([...LOBE_IDS]);
    expect(c.reduce((a, x) => a + x.complianceFraction, 0)).toBeCloseTo(1, 9);
    expect(c.reduce((a, x) => a + x.conductanceFraction, 0)).toBeCloseTo(1, 9);
  });
  it("every preset case has five lobes with fractions summing to 1", () => {
    for (const id of ["healthy-adult", "ards-like", "obstructive"]) {
      const cs = caseInput(id).compartments;
      expect(cs).toHaveLength(5);
      expect(cs.reduce((a, x) => a + x.complianceFraction, 0)).toBeCloseTo(1, 6);
      expect(cs.reduce((a, x) => a + x.conductanceFraction, 0)).toBeCloseTo(1, 6);
    }
  });
});

describe("one-lung ventilation (right lung excluded)", () => {
  const bilateral = engineWith([], 30);
  const one = engineWith(lungModeInputs("one-lung"), 30);
  it("an excluded lobe has no flow and no volume change", () => {
    for (let i = 0; i < one.samples.length; i++) {
      const s = one.samples.at(i);
      for (const k of [0, 1, 2]) { expect(s.compVolumes[k]).toBe(0); expect(s.compOpen[k]).toBe(false); }
    }
  });
  it("the whole tidal volume goes to the left lung", () => {
    const peakLeft = Math.max(...Array.from({ length: one.samples.length }, (_, i) => one.samples.at(i).compVolumes[3] + one.samples.at(i).compVolumes[4]));
    const set = one.settings.vtMl / 1000;
    expect(peakLeft).toBeGreaterThan(set * 0.97);
    expect(peakLeft).toBeLessThan(set * 1.5 + 0.1);
  });
  it("volume is still delivered (VC) but peak and plateau pressure rise and compliance falls to about the left-lung share", () => {
    const b0 = lastBreathWithHold(bilateral), b1 = lastBreathWithHold(one);
    expect(b1.vtiL).toBeCloseTo(b0.vtiL, 2);
    expect(b1.ppeak).toBeGreaterThan(b0.ppeak + 5);
    expect(b1.pplat.value!).toBeGreaterThan(b0.pplat.value! + 2.5);
    expect(b1.staticCompliance.value!).toBeLessThan(b0.staticCompliance.value! * 0.75);
    expect(b1.staticCompliance.value!).toBeGreaterThan(b0.staticCompliance.value! * 0.3);
  });
  it("lobar shunt rises to roughly the perfusion share of the isolated lung and lowers PaO2 at the same FiO2", () => {
    const comps = one.compartments;
    const shunt = lobarShuntFraction(comps, 0.03);
    expect(shunt).toBeGreaterThan(0.45);
    expect(shunt).toBeLessThan(0.6);
    const base = computeGasExchange({ fio2: 0.4, rr: 14, vtL: 0.45, deadSpaceL: 0.15, shuntFraction: lobarShuntFraction(bilateral.compartments, 0.03) });
    const ols = computeGasExchange({ fio2: 0.4, rr: 14, vtL: 0.45, deadSpaceL: 0.15, shuntFraction: shunt });
    expect(ols.pao2MmHg).toBeLessThan(base.pao2MmHg - 30);
  });
  it("the right lobes show as collapsed and the left lobes expand, derived from the engine", () => {
    const v = lungVisual(one);
    for (const l of v.lobes.slice(0, 3)) { expect(l.excluded).toBe(true); expect(l.expansion).toBeLessThan(0.4); }
    expect(v.lobes[3].excluded).toBe(false);
  });
  it("can be undone: re-including the lobes restores bilateral mechanics", () => {
    const e = engineWith(lungModeInputs("one-lung"), 10);
    e.apply({ type: "setLobes", aeration: { RUL: 1, RML: 1, RLL: 1 }, excluded: { RUL: false, RML: false, RLL: false } });
    for (let t = 0; t < 20000; t += 5) e.step(5);
    const b = lastBreathWithHold(e), b0 = lastBreathWithHold(bilateral);
    expect(b.pplat.value!).toBeCloseTo(b0.pplat.value!, 0);
  });
});

describe("per-lobe aeration (setLobeExpansion)", () => {
  it("collapsing the right lung (0.35) lowers total compliance and shifts volume to the other lobes", () => {
    const base = engineWith([], 25);
    const col = engineWith([lobeExpansionInput({ rul: 0.35, rml: 0.35, rll: 0.35 })], 25);
    const b0 = lastBreathWithHold(base), b1 = lastBreathWithHold(col);
    expect(b1.staticCompliance.value!).toBeLessThan(b0.staticCompliance.value!);
    expect(b1.pplat.value!).toBeGreaterThan(b0.pplat.value!);
    const vis = lungVisual(col);
    for (const l of vis.lobes.slice(0, 3)) expect(l.expansion).toBeLessThanOrEqual(0.36);
    expect(vis.lobes[3].aeration).toBe(1);
  });
  it("is clamped to 0..1 and ignores unknown or non-finite values", () => {
    const i = lobeExpansionInput({ rul: 3, lll: -2, rml: NaN });
    expect(i).toEqual({ type: "setLobes", aeration: { RUL: 1, LLL: 0 } });
  });
  it("lobar shunt equals base when everything is aerated and grows with collapse", () => {
    const c = makeCompartments();
    expect(lobarShuntFraction(c, 0.03)).toBeCloseTo(0.03, 9);
    c[2].aeration = 0.5;
    expect(lobarShuntFraction(c, 0.03)).toBeGreaterThan(0.1);
  });
  it("aeration change keeps the respiratory system consistent (equilibrium pressure = PEEP everywhere)", () => {
    const s = new RespiratorySystem(makePatient(), makeCompartments());
    s.equilibrate(8);
    s.setLobeState({ aeration: { RLL: 0.5 } });
    s.equilibrate(8);
    for (let i = 0; i < 5; i++) expect(s.pAlv(i, 0)).toBeCloseTo(8, 6);
  });
});

describe("ventilator API mapping (window.LungSim.setVentilator)", () => {
  const cur = DEFAULT_VENT_SETTINGS;
  it("maps vt/peep/rr/fio2 with percentage or fraction FiO2", () => {
    expect(apiSettingsPatch({ vt: 500, peep: 8, rr: 18, fio2: 60 }, cur)).toMatchObject({ vtMl: 500, peepCmH2O: 8, rr: 18, fio2: 0.6 });
    expect(apiSettingsPatch({ fio2: 0.5 }, cur).fio2).toBe(0.5);
  });
  it("clamps to safe ranges", () => {
    expect(apiSettingsPatch({ vt: 5000, peep: 99, rr: 1000, fio2: 500 }, cur)).toMatchObject({ vtMl: 1000, peepCmH2O: 30, rr: 40, fio2: 1 });
  });
  it("I:E sets the inspiratory time; VC derives flow from VT/Ti", () => {
    const p = apiSettingsPatch({ rr: 15, ieRatio: "1:2", vt: 450 }, cur);
    expect(p.tiSec).toBeCloseTo(60 / 15 / 3, 2);
    expect(p.inspFlowLpm).toBeCloseTo(Math.round((0.45 / (60 / 15 / 3)) * 60), 0);
    expect(parseIeRatio("1:2")).toBeCloseTo(0.5);
    expect(parseIeRatio("bogus")).toBeNull();
    expect(parseIeRatio(0.5)).toBe(0.5);
  });
  it("PC mode keeps flow free and only sets Ti", () => {
    const p = apiSettingsPatch({ mode: "PC-CMV", ieRatio: "1:1", rr: 20 }, cur);
    expect(p.mode).toBe("PC-A/C");
    expect(p.tiSec).toBeCloseTo(1.5, 2);
    expect(p.inspFlowLpm).toBeUndefined();
  });
});

describe("lung modes run on the engine and are replayable through the runner", () => {
  it("each mode produces breaths and finite signals", () => {
    for (const m of LUNG_MODES) {
      const e = engineWith(lungModeInputs(m.id), 25);
      expect(e.breaths.length).toBeGreaterThan(4);
      const v = lungVisual(e);
      expect(v.lobes).toHaveLength(5);
      for (const l of v.lobes) expect(Number.isFinite(l.expansion)).toBe(true);
    }
  });
  it("COPD at the mode's rate shows incomplete expiration (end-expiratory volume above baseline); healthy does not", () => {
    const copd = engineWith(lungModeInputs("copd"), 40);
    const healthy = engineWith(lungModeInputs("vc"), 40);
    expect(copd.lastBreath!.incompleteExpiration).toBe(true);
    expect(copd.lastBreath!.endExpVolumeL).toBeGreaterThan(0.03);
    expect(healthy.lastBreath!.incompleteExpiration).toBe(false);
  });
  it("seek-back replays the same lobar state (determinism incl. setLobes)", () => {
    const r = new SimulationRunner<VentSnapshot, VentInput>(new VentilatorEngine({}));
    r.stepForward(1000);
    r.dispatch(lobeExpansionInput({ rul: 0.5 }));
    r.stepForward(2000);
    const a = lungVisual(r.engine as VentilatorEngine).lobes.map((l) => l.volumeMl);
    r.seek(1500);
    r.seek(r.horizon);
    const b = lungVisual(r.engine as VentilatorEngine).lobes.map((l) => l.volumeMl);
    expect(b).toEqual(a);
  });
  it("ARDS mode: lower compliance and a driving pressure above the healthy value at similar VT", () => {
    const a = lastBreathWithHold(engineWith(lungModeInputs("ards"), 30));
    const h = lastBreathWithHold(engineWith(lungModeInputs("vc"), 30));
    expect(a.staticCompliance.value!).toBeLessThan(h.staticCompliance.value! * 0.6);
    expect(a.drivingPressure.value!).toBeGreaterThan(h.drivingPressure.value!);
    void vtOf;
  });
});
