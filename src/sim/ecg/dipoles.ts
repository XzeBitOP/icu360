import type { Vector3 } from "@/sim/types";
import { TISSUE_BY_ID, type TissueNodeId } from "@/sim/cardiac-ep";
import { vmid, vnorm, vsub } from "./leads";

/**
 * Equivalent-dipole forward model. Each dipole pair (a, b) represents tissue between two cell groups:
 *   p(t) = mass · û · (Vm_a(t) − Vm_b(t))
 * so a depolarisation wave travelling a → b gives a dipole along +û, and repolarisation that starts at `a` gives −û
 * (T waves therefore emerge from repolarisation order, not from inverting the QRS).
 * Masses/directions are model parameters (schematic anatomy), documented in docs/MODEL_ASSUMPTIONS.md.
 */
export type DipolePair = { a: TissueNodeId; b: TissueNodeId; mass: number; dir: Vector3; source: Vector3; label: string };

type Def = [a: TissueNodeId, b: TissueNodeId, mass: number, dir: Vector3 | null, label: string];

const D = (x: number, y: number, z: number): Vector3 => vnorm({ x, y, z });

const DEFS: Def[] = [
  // Atria
  ["raHigh", "raLow", 0.2, D(-0.1, 0.75, 0.65), "RA: crista terminalis, superior → inferior"],
  ["raHigh", "laHigh", 0.2, D(0.95, 0, -0.3), "Bachmann bundle: right → left atrium"],
  ["laHigh", "laLow", 0.2, D(0.35, 0.45, -0.82), "LA: antero-superior → postero-lateral"],
  // Ventricles: transmural (endocardium → epicardium), outward direction
  ["sepL", "sepR", 0.9, D(-0.8, 0.15, 0.58), "Septum: LV surface → RV surface (left-to-right)"],
  ["lvaEndo", "lvaEpi", 1.0, D(0.4, 0.45, 0.8), "LV antero-apical wall (transmural)"],
  ["lvlEndo", "lvlEpi", 1.2, D(0.95, 0.1, -0.25), "LV lateral wall (transmural)"],
  ["lviEndo", "lviEpi", 1.6, D(0.15, 0.95, -0.3), "LV inferior wall (transmural)"],
  ["lvbEndo", "lvbEpi", 1.0, D(0.3, -0.2, -0.93), "LV postero-basal wall (transmural)"],
  ["rvEndo", "rvEpi", 0.45, D(-0.6, 0.15, 0.78), "RV free wall (transmural)"],
  ["rvoEndo", "rvoEpi", 0.6, D(-0.3, -0.6, 0.74), "RV outflow (transmural)"],
  // Sequential endocardial spread between neighbouring segments (matters when Purkinje routes are blocked)
  ["sepL", "lvaEndo", 0.5, null, "Spread: septum → antero-apical LV"],
  ["sepL", "lviEndo", 0.5, null, "Spread: septum → inferior LV"],
  ["lvaEndo", "lvlEndo", 0.5, null, "Spread: antero-apical → lateral LV"],
  ["lviEndo", "lvlEndo", 0.5, null, "Spread: inferior → lateral LV"],
  ["lvlEndo", "lvbEndo", 0.5, null, "Spread: lateral → postero-basal LV"],
  ["lviEndo", "lvbEndo", 0.5, null, "Spread: inferior → postero-basal LV"],
  ["sepR", "rvEndo", 0.5, null, "Spread: RV septal surface → RV free wall"],
  ["rvEndo", "rvoEndo", 0.5, null, "Spread: RV free wall → RV outflow"],
];

export const DIPOLE_PAIRS: DipolePair[] = DEFS.map(([a, b, mass, dir, label]) => {
  const pa = TISSUE_BY_ID[a].pos;
  const pb = TISSUE_BY_ID[b].pos;
  return { a, b, mass, dir: dir ?? vnorm(vsub(pb, pa)), source: vmid(pa, pb), label };
});
