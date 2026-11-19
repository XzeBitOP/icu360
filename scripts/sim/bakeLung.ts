import { LOBES, LOBE_NAMES, LUNG_BOUNDS, lobeAt, lungField, type LobeId } from "../../src/components/sim3d/lung/anatomy.ts";
import { noise3, type V3 } from "../../src/components/sim3d/sdf.ts";
import type { BakeSpec } from "../bake-sim-meshes.ts";

const BASE: [number, number, number] = [214, 108, 124];
const mix = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function bakeLung(cell: number): BakeSpec {
  const h = Number.isFinite(cell) && cell > 0 ? cell : 0.05;
  const names: Record<string, string> = {};
  for (const id of LOBES) names[id] = LOBE_NAMES[id];
  return {
    out: "public/sim/lung.bin",
    field: lungField,
    lo: LUNG_BOUNDS.lo, hi: LUNG_BOUNDS.hi, h,
    region: (p: V3) => lobeAt(p) as LobeId,
    names,
    relax: 3,
    colour: (p, r) => {
      // pale rose parenchyma with a faint mottled/lobular tint; the slight lobe-wise hue helps tell the five lobes apart
      const tint: Record<string, [number, number, number]> = { RUL: [222, 116, 130], RML: [214, 104, 128], RLL: [208, 102, 118], LUL: [222, 114, 126], LLL: [206, 100, 116] };
      const n = 0.86 + 0.22 * noise3(p, 4.5) + 0.1 * noise3(p, 12);
      const base = mix(BASE, tint[r] ?? BASE, 0.8);
      return [Math.min(255, base[0] * n), Math.min(255, base[1] * n), Math.min(255, base[2] * n)];
    },
  };
}
