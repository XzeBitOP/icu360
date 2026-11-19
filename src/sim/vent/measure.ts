import type { BreathRecord, VentSample, VentSettings, MeasurementValidity } from "./types";

const invalid = (reason: string): MeasurementValidity => ({ value: null, valid: false, reason });
const ok = (value: number): MeasurementValidity => ({ value, valid: true });

/**
 * Breath-level measurements computed from the SAME waveform samples that are displayed (spec §48).
 * Measurements that need specific conditions (plateau, resistance, total PEEP) are only reported when those conditions held.
 */
export function measureBreath(
  samples: VentSample[],
  idx: number,
  settings: VentSettings,
  pbwKg: number,
  stepSec: number,
  triggeredBy: "patient" | "time",
  startMs: number,
  endMs: number,
): BreathRecord {
  const insp = samples.filter((s) => s.phase === "inspiration");
  const hold = samples.filter((s) => s.phase === "inspiratory_hold");
  const exp = samples.filter((s) => s.phase === "expiration");
  const epause = samples.filter((s) => s.phase === "expiratory_pause");
  const dt = stepSec;

  let vti = 0, vte = 0, peakIn = 0, peakEx = 0, sumP = 0;
  for (const s of samples) {
    if (s.flow > 0) vti += s.flow * dt; else vte -= s.flow * dt;
    peakIn = Math.max(peakIn, s.flow);
    peakEx = Math.min(peakEx, s.flow);
    sumP += s.paw;
  }
  const ppeak = insp.length ? Math.max(...insp.map((s) => s.paw)) : NaN;
  const effortInHold = hold.some((s) => s.pmus > 0.5);
  const effortInPause = epause.some((s) => s.pmus > 0.5);
  const effortInInsp = insp.some((s) => s.pmus > 0.5);
  const effortInExp = exp.some((s) => s.pmus > 0.5);

  let pplat: MeasurementValidity = invalid("Needs an inspiratory pause (use Inspiratory hold) of at least 0.3 s.");
  if (hold.length >= 60) {
    const last = hold[hold.length - 1];
    const settled = hold.length >= 2 && Math.abs(last.flow) < 0.02;
    pplat = effortInHold ? invalid("Patient effort during the hold makes the plateau pressure unreliable.")
      : !settled ? invalid("Flow had not reached zero.")
      : ok(last.paw);
  }
  let peepTotal: MeasurementValidity = invalid("Needs an expiratory hold of at least 1 s with no patient effort.");
  if (epause.length >= 200) {
    peepTotal = effortInPause ? invalid("Patient effort during the hold.") : ok(epause[epause.length - 1].paw);
  }

  const endExpFlow = exp.length ? exp[exp.length - 1].flow : 0;
  const lastExp = exp.length ? exp[exp.length - 1] : samples[samples.length - 1];
  const endExpVolume = lastExp.volume;
  const incomplete = exp.length > 10 && Math.abs(endExpFlow) > 0.02;

  const vtMl = vti * 1000;
  const peepRef = peepTotal.valid ? peepTotal.value! : settings.peepCmH2O;
  const drivingPressure: BreathRecord["drivingPressure"] = pplat.valid
    ? { ...ok(pplat.value! - peepRef), basis: peepTotal.valid ? "Pplat − total PEEP (measured)" : "Pplat − set PEEP (assumes no auto-PEEP; do an expiratory hold)" }
    : invalid("Needs a valid plateau pressure.");
  const staticCompliance: MeasurementValidity = pplat.valid && pplat.value! - peepRef > 0.1 ? ok(vti / (pplat.value! - peepRef)) : invalid("Needs a valid plateau pressure.");
  const dynamicCompliance: MeasurementValidity = Number.isFinite(ppeak) && ppeak - settings.peepCmH2O > 0.1 ? ok(vti / (ppeak - settings.peepCmH2O)) : invalid("No inspiratory pressure rise.");

  let resistance: MeasurementValidity = invalid("Needs volume control with square flow and a valid plateau pressure.");
  if (settings.mode === "VC-A/C" && settings.flowPattern === "square" && pplat.valid && insp.length > 4 && !effortInInsp) {
    const lastIn = insp[insp.length - 1];
    if (lastIn.flow > 0.05 && !lastIn.pressureLimited) resistance = ok((lastIn.paw - pplat.value!) / lastIn.flow);
  }

  let tau: MeasurementValidity = invalid("Needs passive expiration with measurable expiratory flow.");
  if (exp.length > 20 && peakEx < -0.05 && !effortInExp && !incomplete) tau = ok(vte / -peakEx);
  else if (exp.length > 20 && peakEx < -0.05 && !effortInExp) tau = { value: vte / -peakEx, valid: false, reason: "Expiration incomplete: estimate unreliable." };

  const tiSec = (insp.length + hold.length) * dt;
  const teSec = (exp.length + epause.length) * dt;
  const period = (endMs - startMs) / 1000;
  const rrMeasured = period > 0 ? 60 / period : 0;

  return {
    index: idx, startMs, endMs, triggeredBy, mode: settings.mode, settings: { ...settings },
    ppeak: Number.isFinite(ppeak) ? ppeak : settings.peepCmH2O,
    pplat, peepSet: settings.peepCmH2O, peepTotal,
    vtiL: vti, vteL: vte, rrMeasured, mvLPerMin: vte * rrMeasured,
    tiSec, teSec, ieRatio: tiSec > 0 ? teSec / tiSec : 0,
    meanPaw: samples.length ? sumP / samples.length : 0,
    peakInspFlowLps: peakIn, peakExpFlowLps: peakEx, endExpFlowLps: endExpFlow,
    incompleteExpiration: incomplete, endExpVolumeL: endExpVolume,
    drivingPressure, staticCompliance, dynamicCompliance, resistance, expiratoryTimeConstantSec: tau,
    vtPerPbwMlPerKg: vtMl / pbwKg,
    pressureLimited: samples.some((s) => s.pressureLimited),
    effortDetected: samples.some((s) => s.pmus > 0.5),
  };
}
