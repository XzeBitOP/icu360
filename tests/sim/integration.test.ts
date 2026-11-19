import { describe, expect, it } from "vitest";
import { computeGasExchange, paco2MmHg, saO2Severinghaus, phHendersonHasselbalch, pao2WithShunt } from "@/sim/gas";
import { ecgConditionSchema, ventilatorCaseSchema, ECG_CONDITIONS, ECG_PRESETS, VENTILATOR_CASES } from "@/sim/content";
import { mechanicsAt } from "@/sim/cardiac-mech";
import { describeAt, structureActivity } from "@/sim/ecg";
import { SimulationRunner } from "@/sim/core";
import { EcgEngine } from "@/sim/ecg";
import { MODEL_DISCLAIMER } from "@/sim/types";
import { ecg } from "./helpers";

describe("Gas exchange (directional, simplified)", () => {
  it("halving alveolar ventilation roughly doubles PaCO2 and lowers pH", () => {
    const a = computeGasExchange({ fio2: 0.4, rr: 14, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0.03 });
    const b = computeGasExchange({ fio2: 0.4, rr: 7, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0.03 });
    expect(b.paco2MmHg / a.paco2MmHg).toBeCloseTo(2, 5);
    expect(b.ph).toBeLessThan(a.ph);
    expect(a.paco2MmHg).toBeGreaterThan(30); expect(a.paco2MmHg).toBeLessThan(50);
  });
  it("shunt lowers PaO2 and the P/F ratio, and FiO2 changes it less when shunt is large", () => {
    const lo = computeGasExchange({ fio2: 0.4, rr: 14, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0.03 });
    const hi = computeGasExchange({ fio2: 0.4, rr: 14, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0.3 });
    expect(hi.pao2MmHg).toBeLessThan(lo.pao2MmHg - 20);
    const hi100 = computeGasExchange({ fio2: 1, rr: 14, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0.3 });
    const lo100 = computeGasExchange({ fio2: 1, rr: 14, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0.03 });
    expect(hi100.pao2MmHg - hi.pao2MmHg).toBeLessThan(lo100.pao2MmHg - lo.pao2MmHg);
  });
  it("equation anchors: SaO2 curve, Henderson–Hasselbalch, PaCO2", () => {
    expect(saO2Severinghaus(100)).toBeGreaterThan(0.97); expect(saO2Severinghaus(27)).toBeCloseTo(0.5, 1); expect(saO2Severinghaus(40)).toBeCloseTo(0.75, 1);
    expect(phHendersonHasselbalch(40)).toBeCloseTo(7.4, 1);
    expect(paco2MmHg(200, 5)).toBeCloseTo(0.863 * 200 / 5, 6);
    expect(pao2WithShunt(100, 0)).toBeCloseTo(100, 0);
  });
  it("always lists its assumptions", () => { expect(computeGasExchange({ fio2: 0.21, rr: 12, vtL: 0.5, deadSpaceL: 0.15, shuntFraction: 0 }).assumptions.length).toBeGreaterThan(2); });
});

describe("Clinical content schema", () => {
  it("ECG conditions validate; each has exactly 12 distinct lead findings and is unreviewed", () => {
    for (const c of ECG_CONDITIONS) {
      expect(ecgConditionSchema.safeParse(c).success, c.id).toBe(true);
      expect(new Set(c.leadFindings.map((l) => l.lead)).size).toBe(12);
      expect(c.validation.status).toBe("unreviewed");
    }
  });
  it("schemas reject: 11 leads, validated without reviewer, compartment fractions not summing to 1", () => {
    const c = ECG_CONDITIONS[0];
    expect(ecgConditionSchema.safeParse({ ...c, leadFindings: c.leadFindings.slice(0, 11) }).success).toBe(false);
    expect(ecgConditionSchema.safeParse({ ...c, validation: { status: "validated" } }).success).toBe(false);
    const v = VENTILATOR_CASES[0];
    expect(ventilatorCaseSchema.safeParse({ ...v, regionalCompartments: v.regionalCompartments.map((r) => ({ ...r, complianceFraction: r.complianceFraction * 0.5 })) }).success).toBe(false);
  });
  it("every preset used by a condition exists and the disclaimer is present", () => {
    for (const c of ECG_CONDITIONS) expect(Object.keys(ECG_PRESETS)).toContain(c.id);
    expect(MODEL_DISCLAIMER).toMatch(/educational/i);
  });
});

describe("ECG explanation + mechanics derive from simulation state", () => {
  it("each wave segment is explained from active structures, and mechanics follow the electrical events", () => {
    const e = ecg();
    const b = e.beats[6].ep, f = b.fiducials;
    const mid = (a: number, c: number) => (a + c) / 2;
    expect(describeAt(e, mid(f.pOnsetMs, f.pEndMs)).segment).toBe("P");
    expect(describeAt(e, mid(f.qrsOnsetMs!, f.qrsEndMs!)).segment).toBe("QRS");
    expect(describeAt(e, mid(f.qrsEndMs!, f.tEndMs!)).segment).toMatch(/ST|T/);
    const act = structureActivity(e, mid(f.pOnsetMs, f.pEndMs));
    expect(act["saNode"]).toBeDefined();
    const beats = e.beats.map((x) => x.ep);
    const early = mechanicsAt(beats, f.qrsOnsetMs! - 20), late = mechanicsAt(beats, f.qrsEndMs! + 60);
    expect(late.ventricular).toBeGreaterThan(early.ventricular);
    expect(late.phase).toBe("Ventricular ejection");
  });
  it("blocking an edge in the engine changes the activation (and therefore the ECG), not a template", () => {
    const n = ecg(), l = ecg(ECG_PRESETS.lbbb);
    expect(l.beats[6].ep.fiducials.qrsEndMs! - l.beats[6].ep.fiducials.qrsOnsetMs!).toBeGreaterThan(n.beats[6].ep.fiducials.qrsEndMs! - n.beats[6].ep.fiducials.qrsOnsetMs! + 25);
  });
  it("ECG runner: pausing freezes, stepping advances by exactly one step, scrubbing is repeatable", () => {
    const r = new SimulationRunner(new EcgEngine({}));
    r.stepForward(100);
    const t = r.timeMs; r.pause(); r.tick(1000); expect(r.timeMs).toBe(t);
    r.stepForward(1); expect(r.timeMs).toBe(t + 5);
    const v1 = (r.engine as EcgEngine).leadAt(1, 300); r.seek(100); r.seek(900);
    expect((r.engine as EcgEngine).leadAt(1, 300)).toBe(v1);
  });
});
