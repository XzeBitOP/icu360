import type { LungCompartment, RespiratoryPatient } from "@/sim/types";
import { DEFAULT_PERIPHERAL_RESISTANCE } from "./patient";

/**
 * Multi-compartment passive respiratory mechanics solved from the equation of motion (spec §24):
 *   P_aw + P_mus = V/C_RS + R_aw · Flow   (single compartment),
 * generalised to N parallel compartments behind a common central airway:
 *   P_alv,i = V_i / C_L,i + V_total / C_CW − P_mus      (pleural pressure shared; P_mus ≥ 0 = inspiratory effort)
 *   Q_i     = (P_j − P_alv,i) / R_i                      (P_j = pressure at the airway bifurcation)
 *   P_aw    = P_j + R_aw · Q_total
 * Volumes V are measured above the relaxed volume (zero airway pressure, no effort). PEEP and auto-PEEP therefore emerge
 * from the end-expiratory compartment pressures instead of being separately assigned.
 * Pressures cmH2O, volumes L, flow L/s, resistance cmH2O/(L/s), compliance L/cmH2O.
 */
export type CompartmentState = {
  /** Gas volume above relaxed volume, L. */
  v: number;
  /** Whether the unit is open (recruited) and exchanging flow. Closed units keep their (frozen) volume. */
  open: boolean;
};

export class RespiratorySystem {
  patient: RespiratoryPatient;
  compartments: LungCompartment[];
  state: CompartmentState[];
  peripheralResistance: number;

  constructor(patient: RespiratoryPatient, compartments: LungCompartment[], peripheralResistance = DEFAULT_PERIPHERAL_RESISTANCE) {
    this.patient = patient;
    this.compartments = compartments;
    this.peripheralResistance = peripheralResistance;
    this.state = compartments.map((c) => ({ v: 0, open: !c.excluded }));
    this.equilibrate(0);
  }

  /** Per-compartment lung compliance (L/cmH2O). */
  cL(i: number): number {
    return this.patient.complianceLPerCmH2O * this.compartments[i].complianceFraction * this.aeration(i);
  }
  /** Aerated fraction of lobe i (1 = normal). */
  aeration(i: number): number {
    return Math.min(1, Math.max(this.compartments[i].aeration ?? 1, 0.001));
  }
  isExcluded(i: number): boolean {
    return !!this.compartments[i].excluded;
  }
  /** Per-compartment peripheral resistance (cmH2O/(L/s)); fraction of conductance g_i ⇒ R_i = R_p / g_i. */
  r(i: number): number {
    return this.peripheralResistance / Math.max(this.compartments[i].conductanceFraction * this.aeration(i), 1e-6);
  }
  get rCentral(): number {
    return this.patient.airwayResistanceCmH2OPerLPerSec;
  }
  get cCW(): number {
    return this.patient.chestWallComplianceLPerCmH2O;
  }
  get totalVolume(): number {
    return this.state.reduce((a, s) => a + s.v, 0);
  }

  /** Total respiratory-system compliance of the currently open units (series lung + chest wall), L/cmH2O. */
  get systemCompliance(): number {
    const cl = this.state.reduce((a, s, i) => a + (s.open ? this.cL(i) : 0), 0);
    return 1 / (1 / Math.max(cl, 1e-6) + 1 / this.cCW);
  }
  /** Total respiratory-system resistance (central + parallel peripheral of open units), cmH2O/(L/s). */
  get systemResistance(): number {
    const g = this.state.reduce((a, s, i) => a + (s.open ? 1 / this.r(i) : 0), 0);
    return this.rCentral + 1 / Math.max(g, 1e-9);
  }

  /** Set all open compartments to the passive equilibrium at airway pressure `p` (no effort). */
  equilibrate(p: number): void {
    // closed units keep their frozen volume; open ones: V_i = C_i (p − V_total/C_CW)
    const frozen = this.state.reduce((a, s) => a + (s.open ? 0 : s.v), 0);
    const clOpen = this.state.reduce((a, s, i) => a + (s.open ? this.cL(i) : 0), 0);
    // V_open = clOpen (p − (V_open + frozen)/C_CW)
    const vOpen = (clOpen * (p - frozen / this.cCW)) / (1 + clOpen / this.cCW);
    const vOpenSafe = Math.max(vOpen, 0);
    const pPl = (vOpenSafe + frozen) / this.cCW;
    this.state.forEach((s, i) => {
      if (s.open) s.v = Math.max(this.cL(i) * (p - pPl), 0);
    });
  }

  /** Alveolar pressure of compartment i for the given muscle pressure. */
  pAlv(i: number, pmus: number): number {
    return this.state[i].v / this.cL(i) + this.totalVolume / this.cCW - pmus;
  }

  /** Mean alveolar pressure weighted by conductance (what a zero-flow airway occlusion would read). */
  pAlvOcclusion(pmus: number): number {
    let num = 0, den = 0;
    this.state.forEach((s, i) => {
      if (!s.open) return;
      num += this.pAlv(i, pmus) / this.r(i);
      den += 1 / this.r(i);
    });
    return den > 0 ? num / den : 0;
  }

  private sums(pmus: number): { rp: number; s: number } {
    let g = 0, s = 0;
    this.state.forEach((st, i) => {
      if (!st.open) return;
      g += 1 / this.r(i);
      s += this.pAlv(i, pmus) / this.r(i);
    });
    const rp = g > 0 ? 1 / g : 1e9;
    return { rp, s };
  }

  /** Total flow (L/s, + = inspiration) produced by airway pressure `paw`. */
  flowForPressure(paw: number, pmus: number): number {
    const { rp, s } = this.sums(pmus);
    return (paw - rp * s) / (this.rCentral + rp);
  }

  /** Airway pressure required to push total flow `q` (L/s) through the system. */
  pressureForFlow(q: number, pmus: number): number {
    const { rp, s } = this.sums(pmus);
    return this.rCentral * q + rp * (q + s);
  }

  /** Advance compartment volumes by dt seconds given the total flow was imposed/derived, using the junction pressure. */
  integrate(q: number, dt: number, pmus: number): void {
    const { rp, s } = this.sums(pmus);
    const pj = rp * (q + s);
    this.state.forEach((st, i) => {
      if (!st.open) return;
      const qi = (pj - this.pAlv(i, pmus)) / this.r(i);
      st.v += qi * dt;
    });
    this.updateRecruitment(pj, pmus);
  }

  /** Recruitment (opening pressure) and derecruitment (closing pressure) with hysteresis, on transpulmonary pressure. */
  private updateRecruitment(pj: number, pmus: number): void {
    const pPl = this.totalVolume / this.cCW - pmus;
    this.compartments.forEach((c, i) => {
      const st = this.state[i];
      if (c.excluded) return; // isolated lobe: never ventilated
      if (c.recruitmentThresholdCmH2O <= 0 && c.closingPressureCmH2O <= -50) return; // unit has no recruitment mechanics
      if (!st.open) {
        if (pj - pPl >= c.recruitmentThresholdCmH2O) st.open = true;
      } else if (st.v / this.cL(i) < c.closingPressureCmH2O) {
        st.open = false;
      }
    });
  }

  /** Total gas trapped in closed (derecruited) units, L. */
  get closedVolume(): number {
    return this.state.reduce((a, s) => a + (s.open ? 0 : s.v), 0);
  }

  /**
   * Normalised expansion 0..1 of compartment i for display (spec §27): 0 = collapsed, 1 = at the overdistension threshold.
   * e = (FRC_i + V_i) / (FRC_i + V_threshold,i), where V_threshold is the volume above FRC at the overdistension transpulmonary pressure.
   */
  expansion(i: number): number {
    const c = this.compartments[i];
    const st = this.state[i];
    const frc = this.patient.baselineFRC_L * c.complianceFraction;
    const a = this.aeration(i);
    // gas above relaxed volume is st.v; the aerated share of the lobe's FRC is a·frc (collapsed units hold no gas)
    if (!st.open && st.v < 1e-4 && !c.excluded) return 0;
    return Math.max(0, (a * frc + st.v) / (frc + c.overdistensionThresholdL));
  }

  /**
   * Change lobe aeration and/or exclusion. Gas volumes are rescaled so that the state stays consistent: an aeration change
   * scales that lobe's volume by new/old, an excluded lobe is emptied to its relaxed volume (no ventilation, perfusion goes on).
   */
  setLobeState(patch: { aeration?: Record<string, number | undefined>; excluded?: Record<string, boolean | undefined> }): void {
    this.compartments = this.compartments.map((c) => ({ ...c, anatomy: { ...c.anatomy } }));
    this.compartments.forEach((c, i) => {
      const st = this.state[i];
      const oldA = this.aeration(i);
      const a = patch.aeration?.[c.id];
      if (a !== undefined) c.aeration = Math.min(1, Math.max(a, 0.001));
      const ex = patch.excluded?.[c.id];
      if (ex !== undefined) c.excluded = ex;
      if (c.excluded) { st.open = false; st.v = 0; return; }
      if (ex === false || (ex === undefined && !st.open && c.recruitmentThresholdCmH2O <= 0 && c.closingPressureCmH2O <= -50)) st.open = true;
      st.v = Math.max(0, st.v * (this.aeration(i) / oldA));
    });
  }

  clone(): { patient: RespiratoryPatient; compartments: LungCompartment[]; state: CompartmentState[]; peripheralResistance: number } {
    return {
      patient: { ...this.patient },
      compartments: this.compartments.map((c) => ({ ...c, anatomy: { ...c.anatomy } })),
      state: this.state.map((s) => ({ ...s })),
      peripheralResistance: this.peripheralResistance,
    };
  }

  restore(s: ReturnType<RespiratorySystem["clone"]>): void {
    this.patient = { ...s.patient };
    this.compartments = s.compartments.map((c) => ({ ...c, anatomy: { ...c.anatomy } }));
    this.state = s.state.map((x) => ({ ...x }));
    this.peripheralResistance = s.peripheralResistance;
  }
}
