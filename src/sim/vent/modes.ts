/** Spec §28: every mode is defined by trigger, control/target, limit and cycle (never by name alone). */
export type VentMode = "VC-A/C" | "PC-A/C";

export type ModeDefinition = {
  id: VentMode;
  name: string;
  trigger: { type: "time" | "pressure" | "flow" | "neural"; description: string };
  control: { variable: "volume" | "pressure" | "flow" | "proportional"; description: string };
  limit: { variable: "pressure" | "volume" | "flow" | "none"; description: string };
  cycle: { type: "time" | "flow" | "volume" | "pressure" | "neural"; description: string };
  breathType: "mandatory" | "spontaneous" | "mixed";
  patientTriggerAvailable: boolean;
  backupRate: string;
  apnoeaBehaviour: string;
  /** Settings the learner may change in this mode (spec §41: expose only applicable settings). */
  settings: string[];
  keyPoints: string[];
  modelNote: string;
};

export const MODE_DEFINITIONS: Record<VentMode, ModeDefinition> = {
  "VC-A/C": {
    id: "VC-A/C",
    name: "Volume assist/control",
    trigger: { type: "time", description: "Time (set rate) or patient effort (pressure or flow trigger), whichever comes first." },
    control: { variable: "volume", description: "Delivers the set tidal volume with a set inspiratory flow pattern (square or decelerating)." },
    limit: { variable: "pressure", description: "Pressure limit: if airway pressure reaches the limit the breath is pressure-limited and volume is not fully delivered." },
    cycle: { type: "volume", description: "Cycles to expiration when the set volume has been delivered (time = VT / flow), optionally followed by an inspiratory pause." },
    breathType: "mandatory",
    patientTriggerAvailable: true,
    backupRate: "The set rate is the minimum; there is no separate backup.",
    apnoeaBehaviour: "Continues time-triggered mandatory breaths at the set rate.",
    settings: ["fio2", "vtMl", "rr", "peep", "inspFlowLpm", "flowPattern", "triggerType", "pressureTrigger", "flowTrigger", "pressureLimit"],
    keyPoints: [
      "Targets volume, not pressure: airway pressure is the consequence of tidal volume, flow, compliance and resistance.",
      "Lower compliance raises both peak and plateau pressure for the same volume.",
      "Higher resistance raises peak pressure much more than plateau pressure.",
    ],
    modelNote: "Generic educational approximation of volume A/C; manufacturer implementations differ.",
  },
  "PC-A/C": {
    id: "PC-A/C",
    name: "Pressure assist/control",
    trigger: { type: "time", description: "Time (set rate) or patient effort (pressure or flow trigger), whichever comes first." },
    control: { variable: "pressure", description: "Airway pressure is raised to PEEP + inspiratory pressure and held for the set inspiratory time." },
    limit: { variable: "pressure", description: "The inspiratory pressure setting itself is the pressure limit; delivered volume is not controlled." },
    cycle: { type: "time", description: "Cycles to expiration after the set inspiratory time." },
    breathType: "mandatory",
    patientTriggerAvailable: true,
    backupRate: "The set rate is the minimum; there is no separate backup.",
    apnoeaBehaviour: "Continues time-triggered mandatory breaths at the set rate.",
    settings: ["fio2", "pInsp", "tiSec", "rr", "peep", "riseTimeSec", "triggerType", "pressureTrigger", "flowTrigger"],
    keyPoints: [
      "Targets pressure, not volume: tidal volume depends on compliance, resistance, inspiratory time and any patient effort.",
      "Flow is highest at the start of inspiration and decelerates as the lungs fill.",
      "Lower compliance or higher resistance reduces delivered volume at the same pressure setting.",
    ],
    modelNote: "Inspiratory pressure is set ABOVE PEEP in this model (driving pressure setting).",
  },
};
