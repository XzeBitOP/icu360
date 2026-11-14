import { describe, expect, it } from "vitest";
import { simulate, pbw } from "../src/lib/vent";

describe("ventilator model", () => {
  it("volume control: plateau and driving pressure from VT/C", () => {
    const r = simulate({ mode: "VC", vt: 450, pinsp: 15, peep: 5, rr: 14, ti: 1, compliance: 50, resistance: 10 });
    expect(r.autoPeep).toBeLessThan(0.1);
    expect(r.drivingPressure).toBeCloseTo(9, 1);
    expect(r.plateau).toBeCloseTo(14, 1);
    // peak = PEEP + flow*R + VT/C = 5 + 0.45*10 + 9 = 18.5
    expect(r.peak).toBeCloseTo(18.5, 1);
    expect(r.minuteVentilation).toBeCloseTo(6.3, 1);
    expect(r.ie).toBe("1:3.3");
  });
  it("pressure control delivers ~C × ΔP when Ti >> τ", () => {
    const r = simulate({ mode: "PC", vt: 0, pinsp: 15, peep: 5, rr: 12, ti: 1.2, compliance: 40, resistance: 8 });
    expect(r.vtDelivered).toBeGreaterThan(580);
    expect(r.vtDelivered).toBeLessThanOrEqual(600);
  });
  it("obstruction with a fast rate causes auto-PEEP", () => {
    const r = simulate({ mode: "VC", vt: 500, pinsp: 15, peep: 5, rr: 28, ti: 0.9, compliance: 60, resistance: 30 });
    expect(r.autoPeep).toBeGreaterThan(1);
    expect(r.warnings.some((w) => w.text.includes("Auto-PEEP"))).toBe(true);
  });
  it("PBW formula", () => {
    expect(pbw(170, "male")).toBeCloseTo(66.0, 1);
    expect(pbw(160, "female")).toBeCloseTo(52.4, 1);
  });
});
