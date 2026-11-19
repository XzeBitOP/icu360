import type { Vector3 } from "@/sim/types";

/** Spec §10 regions. Graph nodes are a superset: conduction-system regions + finer myocardial tissue nodes. */
export type CardiacRegion =
  | "saNode" | "rightAtrium" | "leftAtrium" | "avNode" | "hisBundle" | "rightBundle" | "leftBundle"
  | "leftAnteriorFascicle" | "leftPosteriorFascicle" | "purkinje" | "septum" | "rightVentricle" | "leftVentricle";

/** Myocardial tissue nodes (schematic). Ventricular walls are modelled as endocardial/epicardial node pairs. */
export type TissueNodeId =
  | "raHigh" | "raLow" | "laHigh" | "laLow"
  | "sepL" | "sepR"
  | "rvEndo" | "rvEpi" | "rvoEndo" | "rvoEpi"
  | "lvaEndo" | "lvaEpi" | "lvlEndo" | "lvlEpi" | "lviEndo" | "lviEpi" | "lvbEndo" | "lvbEpi";

export type ConductionNodeId = "saNode" | "avNode" | "hisBundle" | "rightBundle" | "leftBundle" | "leftAnteriorFascicle" | "leftPosteriorFascicle";

export type NodeId = ConductionNodeId | TissueNodeId;

export type EdgeKind = "sinoatrial" | "atrial" | "bachmann" | "internodal" | "avNodal" | "bundle" | "purkinje" | "myocardial" | "transmural";

/** Spec §10 ConductionEdge, plus an id, a kind and (for units clarity) the base delay. */
export type ConductionEdge = {
  id: string;
  from: NodeId;
  to: NodeId;
  kind: EdgeKind;
  /** Nominal conduction time in ms (model parameter, not a biological constant). */
  delayMs: number;
  enabled: boolean;
  /** 1 = nominal; <1 slows conduction (delay = delayMs / factor); <= 0 is a block. */
  conductionFactor: number;
  refractoryUntilMs: number;
};

export type ActivationEvent = {
  region: CardiacRegion | TissueNodeId;
  onsetMs: number;
  durationMs: number;
  activationStrength: number;
};

export type TissueNode = {
  id: TissueNodeId;
  label: string;
  group: "rightAtrium" | "leftAtrium" | "septum" | "rightVentricle" | "leftVentricle";
  chamber: "atrial" | "ventricular";
  /** Schematic position, heart-centred coordinates (x = patient left, y = inferior, z = anterior). */
  pos: Vector3;
  /** Upstroke (depolarisation) duration of the cell group, ms. */
  upstrokeMs: number;
  /** Time from onset to start of repolarisation at RR = 1000 ms, ms. */
  apdMs: number;
  /** Duration of repolarisation (Vm falling), ms. */
  repolMs: number;
  /** Electromechanical delay: ms from activation onset to force onset. */
  emdMs: number;
};

export type EdgeOverride = { enabled?: boolean; conductionFactor?: number };

export type AvBlockPattern =
  | { type: "none" }
  | { type: "mobitzI"; /** AV delay increment per beat, ms */ incrementMs: number; /** conducted beats per group (e.g. 4 = 4:3) */ groupLength: number }
  | { type: "mobitzII"; /** one in N atrial beats not conducted */ dropEvery: number }
  | { type: "fixed"; /** conducted:atrial, e.g. 2 = 2:1 */ ratio: number };

export type EcgConfig = {
  seed: number;
  /** Sinus node rate, beats/min. */
  sinusRateBpm: number;
  /** Peak-to-peak-ish cyclic variation of the sinus interval, percent (0 = perfectly regular). */
  sinusVariabilityPct: number;
  /** AV nodal conduction time (AV node to His), ms. */
  avNodalDelayMs: number;
  avBlock: AvBlockPattern;
  edgeOverrides: Record<string, EdgeOverride>;
  /** Multiplier on all cell-to-cell (myocardial) conduction speed; <1 = slower. */
  myocardialConductionFactor: number;
  /** Activation-repolarisation coupling: ms of APD shortening per ms of activation delay (0..1). */
  apdCoupling: number;
  /** Scale APD with the preceding RR (sqrt rule). */
  rateAdaptation: boolean;
  /** Time of the first sinus impulse, ms. */
  firstSinusMs: number;
  qtcFormula: "bazett" | "fridericia";
};

export const DEFAULT_ECG_CONFIG: EcgConfig = {
  seed: 1,
  sinusRateBpm: 72,
  sinusVariabilityPct: 0,
  avNodalDelayMs: 92,
  avBlock: { type: "none" },
  edgeOverrides: {},
  myocardialConductionFactor: 1,
  apdCoupling: 0.4,
  rateAdaptation: true,
  firstSinusMs: 250,
  qtcFormula: "bazett",
};
