import { describe, expect, it } from "vitest";
import { interpretAbg, validateAbg } from "../src/lib/abg";

const has = (arr: string[], s: string) => arr.some((d) => d.toLowerCase().includes(s.toLowerCase()));

describe("ABG interpreter", () => {
  it("pure high anion gap metabolic acidosis with appropriate compensation (DKA-like)", () => {
    const r = interpretAbg({ ph: 7.25, pco2: 28, hco3: 12, na: 140, cl: 104 });
    expect(r.consistent).toBe(true);
    expect(r.primary).toBe("metabolic-acidosis");
    expect(r.expectedPco2).toEqual([24, 28]);
    expect(r.ag).toBe(24);
    expect(r.hagma).toBe(true);
    expect(r.deltaRatio).toBeCloseTo(1.0, 2);
    expect(r.diagnoses[0]).toBe("High anion gap metabolic acidosis");
    expect(r.steps.find((s) => s.id === "comp")!.result).toMatch(/Appropriate/);
  });

  it("normal anion gap metabolic acidosis", () => {
    const r = interpretAbg({ ph: 7.28, pco2: 30, hco3: 14, na: 138, cl: 114 });
    expect(r.primary).toBe("metabolic-acidosis");
    expect(r.ag).toBe(10);
    expect(r.hagma).toBe(false);
    expect(r.diagnoses[0]).toBe("Normal anion gap metabolic acidosis");
  });

  it("metabolic acidosis with inadequate respiratory compensation", () => {
    const r = interpretAbg({ ph: 7.1, pco2: 40, hco3: 12, na: 140, cl: 100 });
    expect(r.primary).toBe("metabolic-acidosis");
    expect(has(r.diagnoses, "respiratory acidosis")).toBe(true);
  });

  it("metabolic acidosis with excess respiratory alkalosis (salicylate pattern)", () => {
    const r = interpretAbg({ ph: 7.45, pco2: 20, hco3: 14, na: 140, cl: 102 });
    // pH normal, both low → mixed
    expect(r.primary).toBe("mixed-normal-ph");
    expect(r.hagma).toBe(true);
  });

  it("albumin-corrected anion gap unmasks HAGMA", () => {
    const r = interpretAbg({ ph: 7.3, pco2: 37, hco3: 18, na: 140, cl: 110, albumin: 2 });
    expect(r.ag).toBe(12);
    expect(r.correctedAg).toBe(17);
    expect(r.hagma).toBe(true);
  });

  it("HAGMA + metabolic alkalosis with normal pH and HCO3 (DKA + vomiting)", () => {
    const r = interpretAbg({ ph: 7.4, pco2: 40, hco3: 24, na: 140, cl: 90 });
    expect(r.ag).toBe(26);
    expect(r.hagma).toBe(true);
    expect(has(r.diagnoses, "metabolic alkalosis")).toBe(true);
  });

  it("delta ratio > 2 flags metabolic alkalosis", () => {
    const r = interpretAbg({ ph: 7.32, pco2: 40, hco3: 20, na: 140, cl: 96 });
    // AG 24, delta = 12/4 = 3
    expect(r.deltaRatio).toBeCloseTo(3, 2);
    expect(has(r.diagnoses, "metabolic alkalosis")).toBe(true);
  });

  it("delta ratio < 0.4 = NAGMA predominates", () => {
    const r = interpretAbg({ ph: 7.2, pco2: 26, hco3: 10, na: 140, cl: 115 });
    // AG 15, delta = 3/14 = 0.21
    expect(r.deltaRatio).toBeLessThan(0.4);
    expect(has(r.diagnoses, "normal anion gap")).toBe(true);
  });

  it("acute respiratory acidosis", () => {
    const r = interpretAbg({ ph: 7.24, pco2: 60, hco3: 26, na: 140, cl: 102 });
    expect(r.primary).toBe("respiratory-acidosis");
    expect(r.diagnoses[0]).toMatch(/Acute respiratory acidosis/);
  });

  it("chronic respiratory acidosis (COPD)", () => {
    const r = interpretAbg({ ph: 7.34, pco2: 60, hco3: 31, na: 140, cl: 97 });
    expect(r.primary).toBe("respiratory-acidosis");
    expect(r.diagnoses[0]).toMatch(/Chronic/);
  });

  it("respiratory acidosis with metabolic acidosis", () => {
    const r = interpretAbg({ ph: 7.05, pco2: 60, hco3: 16, na: 140, cl: 100 });
    expect(r.primary).toBe("mixed-acidosis");
    expect(r.hagma).toBe(true);
  });

  it("acute respiratory alkalosis", () => {
    const r = interpretAbg({ ph: 7.55, pco2: 25, hco3: 21, na: 140, cl: 107 });
    expect(r.primary).toBe("respiratory-alkalosis");
    expect(r.diagnoses[0]).toMatch(/Acute respiratory alkalosis/);
  });

  it("metabolic alkalosis with appropriate compensation", () => {
    const r = interpretAbg({ ph: 7.5, pco2: 46, hco3: 35, na: 140, cl: 95 });
    // expected 0.7*35+21 = 45.5 ± 2
    expect(r.primary).toBe("metabolic-alkalosis");
    expect(r.steps.find((s) => s.id === "comp")!.result).toMatch(/Appropriate/);
  });

  it("flags internally inconsistent values", () => {
    const r = interpretAbg({ ph: 7.4, pco2: 40, hco3: 12 });
    expect(r.consistent).toBe(false);
  });

  it("normal gas", () => {
    const r = interpretAbg({ ph: 7.4, pco2: 40, hco3: 24, na: 140, cl: 104 });
    expect(r.primary).toBe("normal");
    expect(r.hagma).toBe(false);
  });

  it("validates ranges", () => {
    expect(validateAbg({ ph: 9, pco2: 40, hco3: 24 }).length).toBe(1);
    expect(validateAbg({ ph: 7.4, pco2: 40, hco3: 24, albumin: 35 }).length).toBe(1);
  });
});
