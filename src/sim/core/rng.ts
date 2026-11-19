/** Seeded deterministic PRNG (mulberry32). State is a single uint32, so it can be snapshotted. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Approximately standard normal (sum of 4 uniforms, bounded and deterministic). */
  normal(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * Math.sqrt(3);
  }
}
