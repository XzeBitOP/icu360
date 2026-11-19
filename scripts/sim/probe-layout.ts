import { buildLayout, valveRing, purkinjeNetwork, LUMEN_LV, LUMEN_RV } from "../../src/components/sim3d/heart/layout.ts";
const L = buildLayout();
const f = (p: number[]) => p.map((x) => x.toFixed(2)).join(",");
console.log("SA", f(L.sa), "AV", f(L.av), "hisEnd", f(L.hisEnd), "rvApex", f(L.rvApex), "lvApex", f(L.lvApex));
for (const t of L.tracts) console.log(t.id, t.pts.length, f(t.pts[0]), "→", f(t.pts[t.pts.length - 1]));
for (const v of ["tricuspid", "mitral", "pulmonary", "aortic"] as const) { const r = valveRing(v); console.log(v, "c", f(r.center), "axis", f(r.axis), "r", r.radius.toFixed(2)); }
const t0 = Date.now();
const pr = purkinjeNetwork(LUMEN_RV, [-0.4, -1.3, -0.12], [-0.2, 1, 0.1], 7);
const pl = purkinjeNetwork(LUMEN_LV, [1.05, -1.4, -0.12], [0.3, 1, 0.05], 11);
console.log("purkinje RV", pr.length, "branches", pr.reduce((a, b) => a + b.pts.length, 0), "pts; LV", pl.length, pl.reduce((a, b) => a + b.pts.length, 0), Date.now() - t0, "ms");
