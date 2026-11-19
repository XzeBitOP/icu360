/** Deterministic simulation clock (spec §7). Physiological time never depends on the browser frame rate. */
export type SimulationSpeed = 0.25 | 0.5 | 1 | 2 | 4;
export const SIMULATION_SPEEDS: readonly SimulationSpeed[] = [0.25, 0.5, 1, 2, 4];

export type SimulationClock = {
  timeMs: number;
  stepMs: number;
  isPlaying: boolean;
  speed: SimulationSpeed;
  seed: number;
};

export function createClock(opts: Partial<SimulationClock> = {}): SimulationClock {
  return { timeMs: 0, stepMs: 5, isPlaying: false, speed: 1, seed: 1, ...opts };
}
