import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { evaluate, identifiers } from "../src/lib/formula";
import { fmtViews, isoWeek } from "../src/lib/format";
import type { CalculatorsFile } from "../src/lib/content-types";

const file = JSON.parse(fs.readFileSync(path.join(__dirname, "../content/shared/calculators.json"), "utf8")) as CalculatorsFile;

describe("calculators.json", () => {
  it("has 50 calculators", () => {
    expect(file.calculators.length).toBe(50);
  });
  for (const c of file.calculators) {
    it(`${c.id}: worked example matches (validate.py tolerance)`, () => {
      const vars: Record<string, number> = {};
      for (const inp of c.inputs) {
        const v = c.example.inputs[inp.id];
        if (inp.type === "boolean") vars[inp.id] = v ? (v === 1 ? (inp.points ?? 1) : v) : 0;
        else vars[inp.id] = v ?? inp.default ?? 0;
      }
      for (const id of identifiers(c.formula)) expect(id in vars, `${id} is an input`).toBe(true);
      const got = evaluate(c.formula, vars);
      const exp = c.example.expected;
      expect(Math.abs(got - exp)).toBeLessThanOrEqual(0.01 * Math.max(1, Math.abs(exp)));
    });
  }
});

describe("formula evaluator", () => {
  it("handles precedence, unary minus and functions", () => {
    expect(evaluate("1 + 2 * 3", {})).toBe(7);
    expect(evaluate("-(2 + 3) * 2", {})).toBe(-10);
    expect(evaluate("Math.max(1, x, 3)", { x: 5 })).toBe(5);
    expect(evaluate("Math.pow(height / 100, 2)", { height: 200 })).toBe(4);
  });
  it("rejects unknown identifiers and code", () => {
    expect(() => evaluate("alert(1)", {})).toThrow();
    expect(() => evaluate("x; y", { x: 1 })).toThrow();
  });
  it("noradrenaline: 0.1 mcg/kg/min, 70 kg, 80 mcg/mL = 5.25 mL/h", () => {
    expect(evaluate("dose * weight * 60 / conc", { dose: 0.1, weight: 70, conc: 80 })).toBeCloseTo(5.25, 5);
  });
});

describe("view formatting", () => {
  it("rounds down to K and M", () => {
    expect(fmtViews(0)).toBe("New");
    expect(fmtViews(999)).toBe("New");
    expect(fmtViews(1000)).toBe("1K");
    expect(fmtViews(18_999)).toBe("18K");
    expect(fmtViews(999_999)).toBe("999K");
    expect(fmtViews(1_000_000)).toBe("1M");
    expect(fmtViews(1_290_000)).toBe("1.2M");
  });
  it("iso week", () => {
    expect(isoWeek(new Date("2026-11-15T00:00:00Z"))).toBe("2026-W46");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    // Sunday 19:00 UTC is Monday 00:30 IST: already the next week in India
    expect(isoWeek(new Date("2026-11-15T19:00:00Z"))).toBe("2026-W47");
    expect(isoWeek(new Date("2026-11-15T18:00:00Z"))).toBe("2026-W46");
  });
});
