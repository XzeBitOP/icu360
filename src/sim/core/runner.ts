import { createClock, type SimulationClock, type SimulationSpeed } from "./clock";

/**
 * An engine is a deterministic state machine advanced in fixed steps.
 * Inputs (user changes) are applied at exact step boundaries so a replay from the log reproduces identical output.
 */
export interface SteppableEngine<Snap, Input> {
  /** Current simulated time. */
  readonly timeMs: number;
  /** Advance exactly one fixed step. */
  step(stepMs: number): void;
  apply(input: Input): void;
  snapshot(): Snap;
  restore(snap: Snap): void;
  /** Return to the reproducible initial state (t = 0) with the initial configuration. */
  reset(): void;
}

type LogEntry<Input> = { timeMs: number; input: Input };
type SnapEntry<Snap> = { timeMs: number; snap: Snap };

export type RunnerOptions = {
  stepMs?: number;
  seed?: number;
  /** Take a snapshot every N ms of simulated time (default 500). */
  snapshotEveryMs?: number;
  /** Max snapshots retained (ring behaviour). */
  maxSnapshots?: number;
  /** Max simulated ms that one tick() call may advance (guards against tab-sleep spirals). */
  maxCatchUpMs?: number;
};

/**
 * Accumulator-driven runner: requestAnimationFrame calls tick(realDtMs) to *render* state;
 * simulated time only advances in whole fixed steps. Supports pause/resume/step/rewind/seek/reset/replay.
 */
export class SimulationRunner<Snap, Input> {
  readonly clock: SimulationClock;
  private acc = 0;
  private log: LogEntry<Input>[] = [];
  private snaps: SnapEntry<Snap>[] = [];
  private readonly snapEvery: number;
  private readonly maxSnaps: number;
  private readonly maxCatchUp: number;
  /** Highest time ever simulated on the current branch; stepping backward never loses the future. */
  private horizonMs = 0;

  constructor(readonly engine: SteppableEngine<Snap, Input>, opts: RunnerOptions = {}) {
    this.clock = createClock({ stepMs: opts.stepMs ?? 5, seed: opts.seed ?? 1 });
    this.snapEvery = opts.snapshotEveryMs ?? 500;
    this.maxSnaps = opts.maxSnapshots ?? 4000;
    this.maxCatchUp = opts.maxCatchUpMs ?? 250;
    this.takeSnapshot();
  }

  get timeMs(): number {
    return this.clock.timeMs;
  }
  get inputLog(): readonly LogEntry<Input>[] {
    return this.log;
  }
  get horizon(): number {
    return this.horizonMs;
  }

  play(): void {
    this.clock.isPlaying = true;
  }
  pause(): void {
    this.clock.isPlaying = false;
    this.acc = 0;
  }
  toggle(): void {
    this.clock.isPlaying ? this.pause() : this.play();
  }
  setSpeed(s: SimulationSpeed): void {
    this.clock.speed = s;
  }

  /** Render-loop hook. Returns the number of fixed steps taken. */
  tick(realDtMs: number): number {
    if (!this.clock.isPlaying) return 0;
    this.acc += Math.min(realDtMs * this.clock.speed, this.maxCatchUp * this.clock.speed);
    let n = 0;
    while (this.acc >= this.clock.stepMs) {
      this.acc -= this.clock.stepMs;
      this.stepOnce();
      n++;
    }
    return n;
  }

  stepForward(steps = 1): void {
    for (let i = 0; i < steps; i++) this.stepOnce();
  }

  /** Step back by restoring the nearest earlier snapshot and deterministically replaying the input log. */
  stepBackward(steps = 1): void {
    this.seek(Math.max(0, this.clock.timeMs - steps * this.clock.stepMs));
  }

  seek(timeMs: number): void {
    const target = Math.max(0, Math.round(timeMs / this.clock.stepMs) * this.clock.stepMs);
    if (target === this.clock.timeMs) return;
    if (target < this.clock.timeMs) {
      let base: SnapEntry<Snap> | undefined;
      for (let i = this.snaps.length - 1; i >= 0; i--) {
        if (this.snaps[i].timeMs <= target) {
          base = this.snaps[i];
          break;
        }
      }
      this.applied.clear();
      if (base) {
        this.engine.restore(base.snap);
        this.clock.timeMs = base.timeMs;
      } else {
        this.engine.reset();
        this.clock.timeMs = 0;
      }
    }
    while (this.clock.timeMs < target) this.stepOnce();
    this.acc = 0;
  }

  /** Dispatch a user input at the current time. If the timeline was rewound, the future is discarded (new branch). */
  dispatch(input: Input): void {
    const t = this.clock.timeMs;
    this.log = this.log.filter((e) => e.timeMs < t || (e.timeMs === t && this.applied.has(e)));
    this.snaps = this.snaps.filter((s) => s.timeMs <= t);
    this.horizonMs = t;
    const entry = { timeMs: t, input };
    this.log.push(entry);
    this.engine.apply(input);
    this.applied.add(entry);
  }

  reset(): void {
    this.engine.reset();
    this.clock.timeMs = 0;
    this.log = [];
    this.snaps = [];
    this.horizonMs = 0;
    this.acc = 0;
    this.applied.clear();
    this.takeSnapshot();
  }

  /** Re-run from t = 0 using the recorded input log (deterministic event replay) up to the given time. */
  replay(toMs: number = this.horizonMs): void {
    this.engine.reset();
    this.applied.clear();
    this.clock.timeMs = 0;
    this.snaps = [];
    this.takeSnapshot();
    while (this.clock.timeMs < toMs) this.stepOnce();
    this.acc = 0;
  }

  /** Log entries already applied to the engine in its current lineage (cleared whenever state is restored). */
  private applied = new Set<LogEntry<Input>>();

  private stepOnce(): void {
    for (const e of this.log) {
      if (e.timeMs === this.clock.timeMs && !this.applied.has(e)) {
        this.engine.apply(e.input);
        this.applied.add(e);
      }
    }
    this.engine.step(this.clock.stepMs);
    this.clock.timeMs += this.clock.stepMs;
    if (this.clock.timeMs > this.horizonMs) this.horizonMs = this.clock.timeMs;
    if (this.clock.timeMs % this.snapEvery === 0) this.takeSnapshot();
  }

  private takeSnapshot(): void {
    const t = this.clock.timeMs;
    if (this.snaps.length && this.snaps[this.snaps.length - 1].timeMs >= t) return;
    this.snaps.push({ timeMs: t, snap: this.engine.snapshot() });
    if (this.snaps.length > this.maxSnaps) this.snaps.shift();
  }
}
