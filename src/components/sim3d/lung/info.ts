import type { PartInfo } from "../shared";

export const LUNG_INFO: Record<string, PartInfo> = {
  EndotrachealTube: { id: "EndotrachealTube", name: "Endotracheal tube", physiology: "Connects the ventilator to the trachea. The inflated cuff seals the airway so set pressure and volume reach the lungs; the tip sits about 3–5 cm above the carina." },
  Trachea: { id: "Trachea", name: "Trachea", physiology: "Cartilaginous airway (C-shaped rings, soft membrane posteriorly) about 11 cm long, ending at the carina." },
  Carina: { id: "Carina", name: "Carina", physiology: "Bifurcation of the trachea into the right and left main bronchi. Highly sensitive to stimulation (cough); a tube tip below it enters a main bronchus." },
  RightMainstemBronchus: { id: "RightMainstemBronchus", name: "Right main bronchus", physiology: "Shorter, wider and more vertical than the left, so aspirated material and a too-deep endotracheal tube usually enter the right lung." },
  LeftMainstemBronchus: { id: "LeftMainstemBronchus", name: "Left main bronchus", physiology: "Longer and more horizontal than the right; passes under the aortic arch." },
  BronchialTree: { id: "BronchialTree", name: "Bronchial tree", physiology: "Repeated dichotomous branching from lobar to terminal bronchioles. Resistance is mostly in the central airways; bronchospasm and secretions raise it and prolong the expiratory time constant." },
  AlveolarClusters: { id: "AlveolarClusters", name: "Alveolar clusters", physiology: "Gas-exchange units. They open (recruit) when the lung is held above the closing pressure, e.g. with PEEP, and brighten with a higher inspired oxygen fraction." },
  Diaphragm: { id: "Diaphragm", name: "Diaphragm", physiology: "Dome-shaped muscle under the lungs. During positive-pressure inspiration the lungs push it down; at end-expiration it rests high." },
  RUL: { id: "RUL", name: "Right upper lobe", physiology: "Above the horizontal fissure. Apical, posterior and anterior segments." },
  RML: { id: "RML", name: "Right middle lobe", physiology: "Between the horizontal and oblique fissures; the right-sided counterpart of the lingula." },
  RLL: { id: "RLL", name: "Right lower lobe", physiology: "Behind and below the oblique fissure; dependent in a supine patient, so prone to atelectasis and aspiration." },
  LUL: { id: "LUL", name: "Left upper lobe", physiology: "Above the oblique fissure; includes the lingula, which forms the cardiac notch with the heart." },
  LLL: { id: "LLL", name: "Left lower lobe", physiology: "Behind and below the oblique fissure; dependent in a supine patient." },
};
