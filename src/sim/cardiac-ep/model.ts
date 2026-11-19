import type { ConductionEdge, EdgeKind, NodeId, TissueNode, TissueNodeId } from "./types";

/**
 * SCHEMATIC conduction + tissue model. Every number here is a model parameter chosen to give adult-like timing
 * (PR ~160 ms, QRS ~85 ms, QT ~380 ms at 72/min). They are not measurements of a real heart.
 */
export const TISSUE_NODES: readonly TissueNode[] = [
  // Atria — activation spreads SA → high RA → low RA (toward AV node) and via Bachmann → LA
  { id: "raHigh", label: "Right atrium (high, SA exit)", group: "rightAtrium", chamber: "atrial", pos: { x: -0.4, y: -0.75, z: 0.2 }, upstrokeMs: 14, apdMs: 195, repolMs: 100, emdMs: 25 },
  { id: "raLow", label: "Right atrium (low, toward AV node)", group: "rightAtrium", chamber: "atrial", pos: { x: -0.4, y: -0.3, z: 0.25 }, upstrokeMs: 14, apdMs: 210, repolMs: 100, emdMs: 25 },
  { id: "laHigh", label: "Left atrium (Bachmann insertion)", group: "leftAtrium", chamber: "atrial", pos: { x: 0.05, y: -0.75, z: -0.15 }, upstrokeMs: 14, apdMs: 235, repolMs: 100, emdMs: 25 },
  { id: "laLow", label: "Left atrium (posterior-lateral)", group: "leftAtrium", chamber: "atrial", pos: { x: 0.4, y: -0.45, z: -0.55 }, upstrokeMs: 14, apdMs: 250, repolMs: 100, emdMs: 25 },
  // Septum (LV-side and RV-side surfaces)
  { id: "sepL", label: "Septum (LV surface)", group: "septum", chamber: "ventricular", pos: { x: 0.05, y: 0.1, z: 0.1 }, upstrokeMs: 10, apdMs: 300, repolMs: 60, emdMs: 35 },
  { id: "sepR", label: "Septum (RV surface)", group: "septum", chamber: "ventricular", pos: { x: -0.1, y: 0.1, z: 0.22 }, upstrokeMs: 10, apdMs: 280, repolMs: 60, emdMs: 35 },
  // Right ventricle: free wall and outflow
  { id: "rvEndo", label: "RV free wall (endocardium)", group: "rightVentricle", chamber: "ventricular", pos: { x: -0.35, y: 0.3, z: 0.45 }, upstrokeMs: 10, apdMs: 292, repolMs: 60, emdMs: 35 },
  { id: "rvEpi", label: "RV free wall (epicardium)", group: "rightVentricle", chamber: "ventricular", pos: { x: -0.7, y: 0.35, z: 0.75 }, upstrokeMs: 10, apdMs: 266, repolMs: 60, emdMs: 35 },
  { id: "rvoEndo", label: "RV outflow (endocardium)", group: "rightVentricle", chamber: "ventricular", pos: { x: -0.3, y: -0.15, z: 0.5 }, upstrokeMs: 10, apdMs: 288, repolMs: 60, emdMs: 35 },
  { id: "rvoEpi", label: "RV outflow (epicardium)", group: "rightVentricle", chamber: "ventricular", pos: { x: -0.5, y: -0.45, z: 0.8 }, upstrokeMs: 10, apdMs: 266, repolMs: 60, emdMs: 35 },
  // Left ventricle: antero-apical, lateral, inferior, postero-basal
  { id: "lvaEndo", label: "LV antero-apical (endocardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.3, y: 0.45, z: 0.3 }, upstrokeMs: 10, apdMs: 305, repolMs: 60, emdMs: 35 },
  { id: "lvaEpi", label: "LV antero-apical (epicardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.55, y: 0.75, z: 0.65 }, upstrokeMs: 10, apdMs: 258, repolMs: 60, emdMs: 35 },
  { id: "lvlEndo", label: "LV lateral (endocardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.4, y: 0.15, z: -0.05 }, upstrokeMs: 10, apdMs: 305, repolMs: 60, emdMs: 35 },
  { id: "lvlEpi", label: "LV lateral (epicardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.95, y: 0.2, z: -0.15 }, upstrokeMs: 10, apdMs: 272, repolMs: 60, emdMs: 35 },
  { id: "lviEndo", label: "LV inferior (endocardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.25, y: 0.55, z: -0.2 }, upstrokeMs: 10, apdMs: 305, repolMs: 60, emdMs: 35 },
  { id: "lviEpi", label: "LV inferior (epicardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.3, y: 0.95, z: -0.35 }, upstrokeMs: 10, apdMs: 272, repolMs: 60, emdMs: 35 },
  { id: "lvbEndo", label: "LV postero-basal (endocardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.25, y: -0.05, z: -0.35 }, upstrokeMs: 10, apdMs: 300, repolMs: 60, emdMs: 35 },
  { id: "lvbEpi", label: "LV postero-basal (epicardium)", group: "leftVentricle", chamber: "ventricular", pos: { x: 0.35, y: -0.2, z: -0.85 }, upstrokeMs: 10, apdMs: 283, repolMs: 60, emdMs: 35 },
];

export const TISSUE_BY_ID: Record<TissueNodeId, TissueNode> = Object.fromEntries(TISSUE_NODES.map((n) => [n.id, n])) as Record<TissueNodeId, TissueNode>;

export const VENTRICULAR_NODE_IDS: TissueNodeId[] = TISSUE_NODES.filter((n) => n.chamber === "ventricular").map((n) => n.id);
export const ATRIAL_NODE_IDS: TissueNodeId[] = TISSUE_NODES.filter((n) => n.chamber === "atrial").map((n) => n.id);

type E = [from: NodeId, to: NodeId, kind: EdgeKind, delayMs: number];

/** Directed edges. avNode→hisBundle delay is overridden per beat by the AV conduction model. */
const EDGE_DEFS: E[] = [
  ["saNode", "raHigh", "sinoatrial", 12],
  ["raHigh", "raLow", "atrial", 34],
  ["raHigh", "laHigh", "bachmann", 42],
  ["laHigh", "laLow", "atrial", 34],
  ["raLow", "avNode", "internodal", 20],
  ["avNode", "hisBundle", "avNodal", 92],
  ["hisBundle", "rightBundle", "bundle", 12],
  ["hisBundle", "leftBundle", "bundle", 6],
  ["leftBundle", "leftAnteriorFascicle", "bundle", 8],
  ["leftBundle", "leftPosteriorFascicle", "bundle", 8],
  // Purkinje terminal fibres: conduction system → endocardium
  ["leftBundle", "sepL", "purkinje", 8],
  ["leftAnteriorFascicle", "lvaEndo", "purkinje", 28],
  ["leftAnteriorFascicle", "lvlEndo", "purkinje", 36],
  ["leftPosteriorFascicle", "lviEndo", "purkinje", 30],
  ["leftPosteriorFascicle", "lvbEndo", "purkinje", 46],
  ["leftPosteriorFascicle", "lvlEndo", "purkinje", 40],
  ["rightBundle", "rvEndo", "purkinje", 34],
  ["rightBundle", "sepR", "purkinje", 28],
  ["rightBundle", "rvoEndo", "purkinje", 55],
  // Cell-to-cell (myocardial) spread — slow, used when a Purkinje route is blocked
  ["sepL", "sepR", "myocardial", 18],
  ["sepR", "sepL", "myocardial", 18],
  ["sepL", "lvaEndo", "myocardial", 34],
  ["sepL", "lviEndo", "myocardial", 34],
  ["lvaEndo", "lvlEndo", "myocardial", 34],
  ["lvlEndo", "lvaEndo", "myocardial", 34],
  ["lviEndo", "lvlEndo", "myocardial", 34],
  ["lvlEndo", "lviEndo", "myocardial", 34],
  ["lvlEndo", "lvbEndo", "myocardial", 34],
  ["lvbEndo", "lvlEndo", "myocardial", 34],
  ["lviEndo", "lvbEndo", "myocardial", 34],
  ["lvbEndo", "lviEndo", "myocardial", 34],
  ["sepR", "rvEndo", "myocardial", 45],
  ["rvEndo", "sepR", "myocardial", 45],
  ["rvEndo", "rvoEndo", "myocardial", 40],
  ["rvoEndo", "rvEndo", "myocardial", 40],
  // Transmural (endocardium → epicardium)
  ["rvEndo", "rvEpi", "transmural", 14],
  ["rvoEndo", "rvoEpi", "transmural", 14],
  ["lvaEndo", "lvaEpi", "transmural", 28],
  ["lvlEndo", "lvlEpi", "transmural", 28],
  ["lviEndo", "lviEpi", "transmural", 28],
  ["lvbEndo", "lvbEpi", "transmural", 28],
];

export const edgeId = (from: NodeId, to: NodeId) => `${from}->${to}`;

export function defaultEdges(): ConductionEdge[] {
  return EDGE_DEFS.map(([from, to, kind, delayMs]) => ({
    id: edgeId(from, to), from, to, kind, delayMs, enabled: true, conductionFactor: 1, refractoryUntilMs: 0,
  }));
}

/** Which user-selectable structure → which edge(s) are blocked/slowed when the learner changes that structure. */
export const STRUCTURE_EDGES: Record<string, string[]> = {
  saNode: [edgeId("saNode", "raHigh")],
  bachmann: [edgeId("raHigh", "laHigh")],
  avNode: [edgeId("avNode", "hisBundle")],
  hisBundle: [edgeId("hisBundle", "rightBundle"), edgeId("hisBundle", "leftBundle")],
  rightBundle: [edgeId("hisBundle", "rightBundle")],
  leftBundle: [edgeId("hisBundle", "leftBundle")],
  leftAnteriorFascicle: [edgeId("leftBundle", "leftAnteriorFascicle")],
  leftPosteriorFascicle: [edgeId("leftBundle", "leftPosteriorFascicle")],
};

/** Regions (spec §10) → graph nodes they contain. */
export const REGION_NODES: Record<string, NodeId[]> = {
  saNode: ["saNode"],
  rightAtrium: ["raHigh", "raLow"],
  leftAtrium: ["laHigh", "laLow"],
  avNode: ["avNode"],
  hisBundle: ["hisBundle"],
  rightBundle: ["rightBundle"],
  leftBundle: ["leftBundle"],
  leftAnteriorFascicle: ["leftAnteriorFascicle"],
  leftPosteriorFascicle: ["leftPosteriorFascicle"],
  septum: ["sepL", "sepR"],
  rightVentricle: ["rvEndo", "rvEpi", "rvoEndo", "rvoEpi"],
  leftVentricle: ["lvaEndo", "lvaEpi", "lvlEndo", "lvlEpi", "lviEndo", "lviEpi", "lvbEndo", "lvbEpi"],
};
