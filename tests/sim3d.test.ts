import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { generateAirways, MAX_GEN, airwayRadius } from "@/components/sim3d/lung/airways";
import { LOBES, lobeField, lobeAt, LOBE_HILUM, LOBE_CENTRE } from "@/components/sim3d/lung/anatomy";
import { buildLayout, valveRing, VALVE_DEFS, LUMEN_LV, LUMEN_RV, lumenAny, type ValveId } from "@/components/sim3d/heart/layout";
import { chainProgress, edgeProgress } from "@/components/sim3d/heart/HeartScene";
import { resolveLungMode } from "@/sim/vent";
import nextConfig from "../next.config";

describe("lung anatomy and airway tree", () => {
  it("is deterministic and keeps every branch inside its lobe", () => {
    for (const id of LOBES) {
      const a = generateAirways(id), b = generateAirways(id);
      expect(a.segments).toEqual(b.segments);
      expect(a.segments.length).toBeGreaterThan(60);
      expect(a.terminals.length).toBeGreaterThan(20);
      for (const s of a.segments) {
        expect(lobeField[id](s.b)).toBeLessThan(0);
        expect(s.gen).toBeLessThanOrEqual(MAX_GEN);
      }
    }
  });
  it("tapers with generation and puts each lobe centre inside its own lobe", () => {
    for (let g = 1; g <= MAX_GEN; g++) expect(airwayRadius(g)).toBeLessThan(airwayRadius(g - 1));
    for (const id of LOBES) { expect(lobeAt(LOBE_CENTRE[id])).toBe(id); expect(lobeField[id](LOBE_CENTRE[id])).toBeLessThan(0); expect(lobeField[id](LOBE_HILUM[id])).toBeLessThan(0.2); }
  });
});

describe("heart layout", () => {
  const L = buildLayout();
  it("places the SA and AV nodes inside the right atrium cavity and the tracts end at the nodes", () => {
    expect(lumenAny(L.sa)).toBeLessThan(0.1);
    expect(lumenAny(L.av)).toBeLessThan(0.1);
    expect(L.sa[0]).toBeLessThan(L.av[0]); // SA node is superolateral to the AV node
    expect(L.sa[1]).toBeGreaterThan(L.av[1]);
    const inter = L.tracts.filter((t) => t.id.startsWith("Internodal"));
    expect(inter).toHaveLength(3);
    const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const t of inter) { expect(d(t.pts[0], L.sa)).toBeLessThan(0.15); expect(d(t.pts[t.pts.length - 1], L.av)).toBeLessThan(0.15); }
  });
  it("has all spec'd conduction structures, with a monotonic path coordinate along each", () => {
    for (const id of ["BachmannsBundle", "BundleOfHis", "RightBundleBranch", "LeftBundleBranch"]) expect(L.tracts.find((t) => t.id === id)).toBeTruthy();
    for (const t of L.tracts) { expect(t.phase).toHaveLength(t.pts.length); expect(t.phase[0]).toBe(0); expect(t.phase[t.phase.length - 1]).toBeCloseTo(1, 5); }
  });
  it("sits all four valve rings on the correct side, with the AV valves in the right-sided and left-sided ventricle inlets", () => {
    const ids = Object.keys(VALVE_DEFS) as ValveId[];
    expect(ids.sort()).toEqual(["aortic", "mitral", "pulmonary", "tricuspid"]);
    expect(VALVE_DEFS.tricuspid.leaflets).toBe(3);
    expect(VALVE_DEFS.mitral.leaflets).toBe(2);
    expect(VALVE_DEFS.aortic.leaflets).toBe(3);
    expect(VALVE_DEFS.pulmonary.leaflets).toBe(3);
    expect(valveRing("tricuspid").center[0]).toBeLessThan(valveRing("mitral").center[0]);
    expect(LUMEN_RV(valveRing("tricuspid").center)).toBeLessThan(0.35);
    expect(LUMEN_LV(valveRing("mitral").center)).toBeLessThan(0.35);
  });
});

describe("wavefront encoding for the conduction overlay", () => {
  it("returns head position while an edge is in transit, trailing glow afterwards, 0 when idle", () => {
    expect(edgeProgress({}, ["a->b"])).toBe(0);
    expect(edgeProgress({ "a->b": 0.4 }, ["a->b"])).toBeCloseTo(0.4);
    expect(edgeProgress({ "a->b": 1.3 }, ["a->b"])).toBeCloseTo(1.3);
    expect(edgeProgress({ "a->b": 1.3, "c->d": 0.2 }, ["a->b", "c->d"])).toBeCloseTo(0.2); // head wins over trail
    expect(edgeProgress({ "a->b": 1.6, "c->d": 1.2 }, ["a->b", "c->d"])).toBeCloseTo(1.2); // the freshest trail
  });
  it("maps consecutive edges onto one tract", () => {
    const segs: [string, number, number][] = [["a->b", 0, 0.2], ["b->c", 0.2, 1]];
    expect(chainProgress({ "a->b": 0.5 }, segs)).toBeCloseTo(0.1);
    expect(chainProgress({ "a->b": 1.2, "b->c": 0.5 }, segs)).toBeCloseTo(0.6);
    expect(chainProgress({}, segs)).toBe(0);
  });
});

describe("LungSim mode names", () => {
  it("resolves the spec's mode names", () => {
    expect(resolveLungMode("VC-CMV")).toBe("vc");
    expect(resolveLungMode("PC-CMV")).toBe("pc");
    expect(resolveLungMode("ARDS lung-protective")).toBe("ards");
    expect(resolveLungMode("COPD/bronchospasm")).toBe("copd");
    expect(resolveLungMode("Right pneumothorax / mainstem intubation")).toBe("one-lung");
    expect(resolveLungMode("SIMV")).toBeNull();
  });
});

describe("ICU 360 integration", () => {
  it("renames the ventilator playground and redirects the old route", async () => {
    const redirects = await (nextConfig as { redirects?: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects!();
    expect(redirects).toContainEqual({ source: "/tools/ventilator", destination: "/tools/ventilator-os", permanent: true });
    expect(existsSync("src/app/tools/ventilator/page.tsx")).toBe(false);
    expect(existsSync("src/components/client/VentPlayground.tsx")).toBe(false);
    for (const f of ["src/app/tools/page.tsx", "src/app/page.tsx", "scripts/prebuild.mjs"]) expect(readFileSync(f, "utf8")).not.toMatch(/Ventilator playground/);
  });
  it("registers both simulators in search, offline precache and the baked 3D meshes", () => {
    const pre = readFileSync("scripts/prebuild.mjs", "utf8");
    for (const s of ["/tools/ecg-os", "/tools/ventilator-os", "/sim/heart.bin", "/sim/lung.bin", "title: \"ECG OS\"", "title: \"Ventilator OS\""]) expect(pre).toContain(s);
    for (const f of ["heart", "heart-hit", "lung", "lung-hit"]) expect(existsSync(`public/sim/${f}.bin`)).toBe(true);
  });
  it("does not import three.js from any eagerly loaded UI module (it must stay in the lazy chunk)", () => {
    for (const f of ["src/components/sim/ecg/EcgApp.tsx", "src/components/sim/vent/VentApp.tsx", "src/components/sim/ecg/store.ts", "src/components/sim/vent/store.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/from "three/);
      expect(s).not.toMatch(/import\("three/);
    }
  });
});
