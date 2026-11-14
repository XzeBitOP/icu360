/**
 * Single-compartment lung model for the ventilator playground (educational).
 * Equation of motion: Paw = PEEP + Flow × R + Volume / C.
 * R in cmH2O/L/s, C in mL/cmH2O, time constant τ = R × C / 1000 (s).
 * Expiration is passive and exponential; gas trapped at end-expiration produces intrinsic PEEP.
 */
export type Mode = "VC" | "PC";
export interface VentSettings {
  mode: Mode;
  vt: number; // mL (VC)
  pinsp: number; // cmH2O above PEEP (PC)
  peep: number; // cmH2O
  rr: number; // breaths/min
  ti: number; // s
  compliance: number; // mL/cmH2O
  resistance: number; // cmH2O/L/s
  pause?: number; // inspiratory pause, s (VC only)
  heightCm?: number;
  sex?: "male" | "female";
}

export interface VentSample { t: number; p: number; flow: number; vol: number }
export interface VentResult {
  samples: VentSample[];
  cycle: number;
  te: number;
  ie: string;
  tau: number;
  vtDelivered: number; // mL
  peak: number;
  plateau: number;
  drivingPressure: number;
  autoPeep: number;
  totalPeep: number;
  minuteVentilation: number; // L/min
  peakInspFlow: number; // L/min
  endExpFlow: number; // L/min (negative = still exhaling)
  pbw?: number;
  vtPerKg?: number;
  warnings: { level: "warn" | "crit"; text: string }[];
}

export function pbw(heightCm: number, sex: "male" | "female") {
  return (sex === "male" ? 50 : 45.5) + 0.91 * (heightCm - 152.4);
}

export function simulate(s: VentSettings, breaths = 2, dt = 0.01): VentResult {
  const cycle = 60 / s.rr;
  const pause = s.mode === "VC" ? Math.min(s.pause ?? 0, Math.max(0, s.ti - 0.1)) : 0;
  const ti = Math.min(s.ti, cycle - 0.05);
  const te = cycle - ti;
  const tau = (s.resistance * s.compliance) / 1000;
  const C = s.compliance;
  const R = s.resistance;
  const k = Math.exp(-te / tau);

  // Steady-state trapped volume above set-PEEP FRC (mL).
  let vTrap = 0;
  let vtDel = 0;
  const flowTi = ti - pause; // VC: time with flow
  for (let i = 0; i < 200; i++) {
    let vEnd: number;
    if (s.mode === "VC") {
      vEnd = vTrap + s.vt;
    } else {
      const vEq = C * s.pinsp;
      vEnd = vEq + (vTrap - vEq) * Math.exp(-ti / tau);
    }
    vtDel = vEnd - vTrap;
    const next = vEnd * k;
    if (Math.abs(next - vTrap) < 1e-6) { vTrap = next; break; }
    vTrap = next;
  }
  const autoPeep = vTrap / C;

  const samples: VentSample[] = [];
  let peak = 0;
  let peakFlow = 0;
  for (let b = 0; b < breaths; b++) {
    for (let t = 0; t <= cycle + 1e-9; t += dt) {
      let vol: number; // above set-PEEP FRC (mL)
      let flow: number; // L/s
      let p: number;
      if (t <= ti) {
        if (s.mode === "VC") {
          const f = s.vt / flowTi; // mL/s
          if (t <= flowTi) {
            vol = vTrap + f * t;
            flow = f / 1000;
          } else {
            vol = vTrap + s.vt;
            flow = 0;
          }
          p = s.peep + flow * R + vol / C;
        } else {
          const vEq = C * s.pinsp;
          vol = vEq + (vTrap - vEq) * Math.exp(-t / tau);
          flow = ((vEq - vTrap) / tau) * Math.exp(-t / tau) / 1000;
          // small rise time so the square wave looks realistic
          const rise = Math.min(1, t / 0.05);
          p = s.peep + s.pinsp * rise;
        }
      } else {
        const te_ = t - ti;
        const vEnd = vTrap + vtDel;
        vol = vEnd * Math.exp(-te_ / tau);
        flow = -(vol / tau) / 1000;
        p = s.peep; // ventilator holds set PEEP; alveolar pressure is higher with auto-PEEP
      }
      if (p > peak) peak = p;
      if (flow * 60 > peakFlow) peakFlow = flow * 60;
      samples.push({ t: b * cycle + t, p, flow: flow * 60, vol: vol - vTrap });
    }
  }

  const plateau = s.peep + (vTrap + vtDel) / C;
  // exact peak (sampling can miss the instant flow stops)
  peak = s.mode === "VC" ? s.peep + (s.vt / flowTi / 1000) * R + (vTrap + s.vt) / C : s.peep + s.pinsp;
  const drivingPressure = vtDel / C;
  const endExpFlow = (-(vTrap / tau) / 1000) * 60;
  const ieRatio = te / ti;
  const ie = ieRatio >= 1 ? `1:${(Math.round(ieRatio * 10) / 10).toString()}` : `${(Math.round((ti / te) * 10) / 10).toString()}:1`;
  const mv = (vtDel * s.rr) / 1000;

  const warnings: VentResult["warnings"] = [];
  let pbwVal: number | undefined;
  let vtPerKg: number | undefined;
  if (s.heightCm && s.sex) {
    pbwVal = pbw(s.heightCm, s.sex);
    vtPerKg = vtDel / pbwVal;
    if (vtPerKg > 8) warnings.push({ level: "warn", text: `Tidal volume ${vtPerKg.toFixed(1)} mL/kg PBW: aim for 6–8 mL/kg (4–6 in ARDS).` });
  }
  if (autoPeep >= 1) warnings.push({ level: autoPeep >= 5 ? "crit" : "warn", text: `Auto-PEEP ≈ ${autoPeep.toFixed(1)} cmH₂O: expiratory flow does not return to zero. Lower the rate, shorten Ti or treat bronchospasm.` });
  if (plateau > 30) warnings.push({ level: "crit", text: `Plateau ${plateau.toFixed(0)} cmH₂O > 30: high risk of lung injury. Reduce tidal volume.` });
  if (drivingPressure > 15) warnings.push({ level: "warn", text: `Driving pressure ${drivingPressure.toFixed(0)} cmH₂O > 15: associated with higher mortality in ARDS.` });
  if (ti > te) warnings.push({ level: "warn", text: `Inverse I:E (${ie}): expiration is shorter than inspiration.` });
  if (s.mode === "VC" && peak - plateau > 10) warnings.push({ level: "warn", text: `Peak–plateau gap ${(peak - plateau).toFixed(0)} cmH₂O: high airway resistance (tube kink, secretions, bronchospasm).` });
  if (mv < 4) warnings.push({ level: "warn", text: `Minute ventilation ${mv.toFixed(1)} L/min is low: watch pCO₂.` });

  return {
    samples,
    cycle,
    te,
    ie,
    tau,
    vtDelivered: vtDel,
    peak,
    plateau,
    drivingPressure,
    autoPeep,
    totalPeep: s.peep + autoPeep,
    minuteVentilation: mv,
    peakInspFlow: peakFlow,
    endExpFlow,
    pbw: pbwVal,
    vtPerKg,
    warnings,
  };
}
