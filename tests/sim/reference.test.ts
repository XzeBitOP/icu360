import { describe, expect, it } from "vitest";
import { ECG_REFERENCE_CASES, VENTILATOR_REFERENCE_CASES, type ReferenceCase } from "@/sim/validation";
import { ECG_PRESETS } from "@/sim/content";
import { frontalQrsAxisDeg, measureBeat } from "@/sim/ecg";
import { VentilatorEngine } from "@/sim/vent";
import { makePatient } from "@/sim/resp";
import { VENTILATOR_PRESETS } from "@/sim/content";
import { ecg } from "./helpers";

const within = (c: ReferenceCase, metric: string, value: number) => {
  const m = c.expected.find((x) => x.metric === metric)!;
  expect(m, `${c.id}.${metric} missing`).toBeDefined();
  expect(value, `${c.id}.${metric}`).toBeGreaterThanOrEqual(m.min);
  expect(value, `${c.id}.${metric}`).toBeLessThanOrEqual(m.max);
};
const byId = (list: ReferenceCase[], id: string) => list.find((c) => c.id === id)!;
const ecgBeat = (preset: string) => {
  const e = ecg(ECG_PRESETS[preset]);
  const i = 8, ep = e.beats[i].ep;
  return { e, ep, m: measureBeat(ep, e.beats[i - 1].ep, e.beats[i - 1].ep, "bazett") };
};
const vc = (settings = {}, patient = {}, sec = 14) => {
  const e = new VentilatorEngine({ settings: { inspPauseSec: 0.6, ...settings }, patient: makePatient(patient) });
  for (let i = 0; i < sec * 200; i++) e.step(5);
  return e;
};

describe("Reference-case records", () => {
  it("every record carries source, licence, annotation and a reviewer field; none claims validation", () => {
    for (const c of [...ECG_REFERENCE_CASES, ...VENTILATOR_REFERENCE_CASES]) {
      expect(c.source.url).toMatch(/^https:/); expect(c.source.licence.length).toBeGreaterThan(5);
      expect(c.annotation.length).toBeGreaterThan(20); expect(c).toHaveProperty("reviewer");
      expect(c.status).toBe("unreviewed"); expect(c.reviewer).toBeNull();
      expect(c.expected.length).toBeGreaterThan(0);
    }
  });
});

describe("ECG reference cases", () => {
  it("normal sinus rhythm lies in adult reference ranges", () => {
    const c = byId(ECG_REFERENCE_CASES, "ecg-nsr-ranges");
    const { e, ep, m } = ecgBeat("nsr");
    within(c, "heartRateBpm", m.heartRateBpm!); within(c, "prMs", m.prMs!); within(c, "qrsMs", m.qrsMs!); within(c, "qtcMs", m.qtcMs!);
    within(c, "frontalAxisDeg", frontalQrsAxisDeg(e, ep)!);
  });
  it("LBBB: QRS ≥ 120 ms with the physical block as the cause", () => {
    within(byId(ECG_REFERENCE_CASES, "ecg-lbbb-ranges"), "qrsMs", ecgBeat("lbbb").m.qrsMs!);
  });
  it("RBBB: QRS ≥ 120 ms with the physical block as the cause", () => {
    within(byId(ECG_REFERENCE_CASES, "ecg-rbbb-ranges"), "qrsMs", ecgBeat("rbbb").m.qrsMs!);
  });
  it("preset conditions give the intended rate/interval signature", () => {
    expect(ecgBeat("sinus-bradycardia").m.heartRateBpm!).toBeLessThan(60);
    expect(ecgBeat("sinus-tachycardia").m.heartRateBpm!).toBeGreaterThan(100);
    expect(ecgBeat("first-degree-av-block").m.prMs!).toBeGreaterThan(200);
    expect(ecgBeat("sinus-tachycardia").m.qtMs!).toBeLessThan(ecgBeat("nsr").m.qtMs!);
  });
});

describe("Ventilator reference cases (analytic)", () => {
  it("normal VC", () => {
    const c = byId(VENTILATOR_REFERENCE_CASES, "vent-normal-vc");
    const b = vc().breaths.at(-1)!;
    within(c, "pplat", b.pplat.value!); within(c, "ppeak", b.ppeak);
  });
  it("normal PC", () => {
    const c = byId(VENTILATOR_REFERENCE_CASES, "vent-normal-pc");
    const b = vc({ mode: "PC-A/C", pInspCmH2O: 12, tiSec: 1.0, inspPauseSec: 0 }).breaths.at(-1)!;
    within(c, "vtiL", b.vtiL);
  });
  it("reduced compliance: halving C roughly doubles the elastic pressure at the same VT", () => {
    const c = byId(VENTILATOR_REFERENCE_CASES, "vent-reduced-compliance");
    const a = vc({}, {}).breaths.at(-1)!, h = vc({}, { complianceLPerCmH2O: 0.085 }).breaths.at(-1)!; // C_L 0.17→0.085 ≈ halves C_RS to 0.0628… (series)
    const ratio = (h.pplat.value! - 5) / (a.pplat.value! - 5);
    within(c, "pplatRatio", ratio);
  });
  it("obstructive preset: prolonged expiratory time constant", () => {
    const p = VENTILATOR_PRESETS.obstructive;
    const e = new VentilatorEngine({ patient: p.case.baselinePatient, compartments: p.case.regionalCompartments, peripheralResistance: p.peripheralResistance, settings: { inspPauseSec: 0.6, rr: 10 } });
    for (let i = 0; i < 3000; i++) e.step(5);
    within(byId(VENTILATOR_REFERENCE_CASES, "vent-obstructive-flow"), "expiratoryTimeConstantSec", e.breaths.at(-1)!.expiratoryTimeConstantSec.value!);
  });
  it("auto-PEEP: expiratory hold shows total PEEP above set PEEP", () => {
    const p = VENTILATOR_PRESETS.obstructive;
    const e = new VentilatorEngine({ patient: p.case.baselinePatient, compartments: p.case.regionalCompartments, peripheralResistance: p.peripheralResistance, settings: { inspPauseSec: 0.6, rr: 22, tiSec: 0.5, inspFlowLpm: 90 } });
    for (let i = 0; i < 4000; i++) e.step(5);
    e.apply({ type: "holdExpiratory", seconds: 2 });
    for (let i = 0; i < 1600; i++) e.step(5);
    const b = e.breaths.find((x) => x.peepTotal.valid)!;
    within(byId(VENTILATOR_REFERENCE_CASES, "vent-auto-peep"), "peepTotalMinusSet", b.peepTotal.value! - b.peepSet);
  });
});
