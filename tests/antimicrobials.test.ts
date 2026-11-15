import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import type { Antimicrobial } from "../src/data/antimicrobial.types";
import { CATEGORIES, generationOf, groupRows, isInvestigational, searchAntimicrobials, toRow } from "../src/lib/antimicrobial-search";

const data = JSON.parse(readFileSync("src/data/antimicrobials.json", "utf8")) as Antimicrobial[];
const schema = JSON.parse(readFileSync("src/data/antimicrobials.schema.json", "utf8"));
const rows = data.map(toRow);
const top = (q: string) => searchAntimicrobials(rows, q)[0]?.id;

describe("antimicrobial data", () => {
  it("validates against the JSON schema", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const ok = validate(data);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it("has unique ids and every category populated", () => {
    expect(new Set(data.map((a) => a.id)).size).toBe(data.length);
    for (const c of CATEGORIES) expect(data.filter((a) => a.category === c).length).toBeGreaterThan(0);
  });

  it("gives no dose for investigational agents", () => {
    const inv = data.filter(isInvestigational);
    expect(inv.length).toBeGreaterThan(0);
    for (const a of inv) expect(a.dose.adult).toMatch(/no dose|not approved/i);
  });

  it("groups category → class → generation without losing drugs", () => {
    const n = CATEGORIES.flatMap((c) => groupRows(rows, c)).reduce((s, g) => s + g.gens.reduce((t, x) => t + x.rows.length, 0), 0);
    expect(n).toBe(data.length);
    const ceph = groupRows(rows, "Antibacterial").find((g) => g.drugClass === "Cephalosporins")!;
    expect(ceph.gens.map((g) => g.generation)).toContain("3rd generation");
    expect(generationOf("4th-gen cephalosporin + BLI")).toBe("4th generation");
  });
});

describe("antimicrobial search", () => {
  it.each([
    ["tazact", "piperacillin-tazobactam"],
    ["pip-tazo", "piperacillin-tazobactam"],
    ["cms", "colistin-colistimethate-sodium-cms"],
    ["l-amb", "liposomal-amphotericin-b"],
    ["meronem", "meropenem"],
    ["zaynich", "cefepime-zidebactam"],
    ["orblicef", "cefepime-enmetazobactam"],
  ])("finds %s", (q, id) => {
    expect(top(q)).toBe(id);
  });

  it("is case-insensitive and tolerates small typos", () => {
    expect(top("MERONEM")).toBe("meropenem");
    expect(top("piptazo")).toBe("piperacillin-tazobactam");
    expect(top("meropenam")).toBe("meropenem");
    expect(top("vancomycn")).toBe("vancomycin");
  });

  it("searches class and indications", () => {
    expect(searchAntimicrobials(rows, "echinocandin").map((r) => r.id)).toContain("caspofungin");
    expect(searchAntimicrobials(rows, "malaria").length).toBeGreaterThan(3);
    expect(searchAntimicrobials(rows, "")).toEqual([]);
  });
});
