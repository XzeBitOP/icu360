import type { Vector3 } from "@/sim/types";

/** The 17 anatomical structures from spec §9, with schematic 3D positions (scene units ≈ cm/2, heart-centred; x left, y up, z toward viewer). */
export type HeartStructure = {
  id: string;
  label: string;
  /** What this structure does, one line. */
  role: string;
  position: Vector3;
  color: string;
  /** Activation events (cardiac-electrophysiology region ids) whose Vm drives this structure's highlight. */
  regions: string[];
  /** ECG deflection produced while this structure is the main activation. */
  producesWave: "P" | "PR segment" | "QRS" | "T" | "none";
};

export const HEART_STRUCTURES: readonly HeartStructure[] = [
  { id: "saNode", label: "SA node", role: "Natural pacemaker; fires the sinus impulse. Too small to produce a visible ECG wave.", position: { x: -0.55, y: 1.35, z: 0.1 }, color: "#fbbf24", regions: ["saNode"], producesWave: "none" },
  { id: "rightAtrium", label: "Right atrium", role: "Activates first; produces the early part of the P wave.", position: { x: -0.75, y: 0.8, z: 0.15 }, color: "#60a5fa", regions: ["rightAtrium"], producesWave: "P" },
  { id: "leftAtrium", label: "Left atrium", role: "Activated via Bachmann bundle; produces the later part of the P wave.", position: { x: 0.45, y: 0.95, z: -0.4 }, color: "#a78bfa", regions: ["leftAtrium"], producesWave: "P" },
  { id: "bachmann", label: "Bachmann bundle", role: "Interatrial pathway carrying the impulse from the right to the left atrium.", position: { x: -0.1, y: 1.15, z: -0.05 }, color: "#c4b5fd", regions: ["leftAtrium"], producesWave: "P" },
  { id: "atrialPathways", label: "Atrial conduction pathways", role: "Preferential internodal routes toward the AV node.", position: { x: -0.6, y: 0.4, z: 0.2 }, color: "#93c5fd", regions: ["rightAtrium"], producesWave: "P" },
  { id: "avNode", label: "AV node", role: "Delays the impulse so the ventricles fill; the PR segment is this delay (isoelectric on the surface ECG).", position: { x: -0.15, y: 0.15, z: 0.1 }, color: "#f97316", regions: ["avNode"], producesWave: "PR segment" },
  { id: "hisBundle", label: "Bundle of His", role: "Carries the impulse across the fibrous skeleton to the bundle branches.", position: { x: -0.05, y: -0.05, z: 0.1 }, color: "#fb7185", regions: ["hisBundle"], producesWave: "PR segment" },
  { id: "rightBundle", label: "Right bundle branch", role: "Conducts to the right ventricle.", position: { x: -0.3, y: -0.6, z: 0.3 }, color: "#f472b6", regions: ["rightBundle"], producesWave: "none" },
  { id: "leftBundle", label: "Left bundle branch", role: "Conducts to the septum and left ventricle via two fascicles.", position: { x: 0.1, y: -0.5, z: 0.05 }, color: "#34d399", regions: ["leftBundle"], producesWave: "none" },
  { id: "leftAnteriorFascicle", label: "Left anterior fascicle", role: "Activates the antero-superior left ventricle.", position: { x: 0.3, y: -0.85, z: 0.3 }, color: "#2dd4bf", regions: ["leftAnteriorFascicle"], producesWave: "none" },
  { id: "leftPosteriorFascicle", label: "Left posterior fascicle", role: "Activates the postero-inferior left ventricle.", position: { x: 0.25, y: -0.85, z: -0.25 }, color: "#22d3ee", regions: ["leftPosteriorFascicle"], producesWave: "none" },
  { id: "purkinje", label: "Purkinje fibres", role: "Distribute the impulse rapidly to the endocardium so the ventricles activate almost together.", position: { x: 0.0, y: -1.45, z: 0.2 }, color: "#e879f9", regions: ["purkinje"], producesWave: "QRS" },
  { id: "septum", label: "Interventricular septum", role: "Normally activated left to right first: the small initial QRS force.", position: { x: 0.0, y: -0.75, z: 0.15 }, color: "#fdba74", regions: ["septum"], producesWave: "QRS" },
  { id: "rightVentricle", label: "Right ventricular myocardium", role: "Thin wall; its forces are normally hidden by the larger left ventricle.", position: { x: -0.85, y: -0.9, z: 0.5 }, color: "#f87171", regions: ["rightVentricle"], producesWave: "QRS" },
  { id: "leftVentricle", label: "Left ventricular myocardium", role: "Dominates the QRS; wall activates endocardium to epicardium.", position: { x: 0.75, y: -0.8, z: 0.0 }, color: "#4ade80", regions: ["leftVentricle"], producesWave: "QRS" },
  { id: "apex", label: "Cardiac apex", role: "Apical region of the left ventricle.", position: { x: 0.55, y: -1.6, z: 0.35 }, color: "#facc15", regions: ["leftVentricle"], producesWave: "QRS" },
  { id: "base", label: "Basal ventricular regions", role: "Activate last; produce the terminal part of the QRS.", position: { x: 0.35, y: -0.1, z: -0.6 }, color: "#38bdf8", regions: ["leftVentricle", "rightVentricle"], producesWave: "QRS" },
];
