import type { PartInfo } from "../shared";

/** Names (as `userData.name`) and one-line physiology for every selectable structure. Educational, simplified. */
export const HEART_INFO: Record<string, PartInfo> = {
  RightAtrium: { id: "RightAtrium", name: "Right atrium", physiology: "Receives deoxygenated blood from the vena cavae. Contracts after the P wave to top up right ventricular filling. Contains the SA and AV nodes." },
  LeftAtrium: { id: "LeftAtrium", name: "Left atrium", physiology: "Receives oxygenated blood from the four pulmonary veins. Depolarises via Bachmann's bundle, producing the terminal part of the P wave." },
  RightVentricle: { id: "RightVentricle", name: "Right ventricle", physiology: "Thin-walled pump for the low-pressure pulmonary circulation. Activated through the right bundle branch; its forces are normally hidden by the larger left ventricle on the ECG." },
  LeftVentricle: { id: "LeftVentricle", name: "Left ventricle", physiology: "Thick-walled systemic pump (note the wall). Dominates the QRS vector. Contracts after an electromechanical delay of a few tens of ms, with a slight apical twist." },
  InterventricularSeptum: { id: "InterventricularSeptum", name: "Interventricular septum", physiology: "Activated first from the left bundle (left to right), giving the small initial septal vector; carries both bundle branches." },
  SuperiorVenaCava: { id: "SuperiorVenaCava", name: "Superior vena cava", physiology: "Returns deoxygenated blood from the head and arms to the right atrium; the SA node lies near its junction." },
  InferiorVenaCava: { id: "InferiorVenaCava", name: "Inferior vena cava", physiology: "Returns deoxygenated blood from the lower body to the right atrium." },
  PulmonaryTrunk: { id: "PulmonaryTrunk", name: "Pulmonary trunk", physiology: "Carries deoxygenated blood from the right ventricle and divides into the right and left pulmonary arteries." },
  AorticArch: { id: "AorticArch", name: "Aortic arch", physiology: "Carries oxygenated blood from the left ventricle. Three branches arise from the arch: brachiocephalic trunk, left common carotid and left subclavian arteries." },
  PulmonaryVeins: { id: "PulmonaryVeins", name: "Pulmonary veins", physiology: "Four veins returning oxygenated blood from the lungs to the left atrium." },
  SANode: { id: "SANode", name: "SA node", physiology: "Natural pacemaker at the upper lateral right atrium near the SVC junction. It fires first; the node itself is too small to appear on the surface ECG." },
  AVNode: { id: "AVNode", name: "AV node", physiology: "At the lower interatrial septum. Conducts slowly, delaying the impulse so the ventricles can fill: this is the PR segment. The glow pauses here." },
  PurkinjeFibers: { id: "PurkinjeFibers", name: "Purkinje fibres", physiology: "Fine network under the endocardium that spreads the impulse rapidly so both ventricles depolarise almost together (the QRS)." },
};
