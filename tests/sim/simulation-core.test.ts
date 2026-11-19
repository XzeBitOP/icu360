import { describe, expect, it } from "vitest";
import { Rng, RingBuffer, SimulationRunner, type SteppableEngine } from "@/sim/core";

/** Toy engine: integrates x' = input gain; deterministic. */
class Toy implements SteppableEngine<{ t: number; x: number; g: number }, { g: number }> {
  timeMs = 0; x = 0; g = 1;
  step(dt: number) { this.x += this.g * dt; this.timeMs += dt; }
  apply(i: { g: number }) { this.g = i.g; }
  snapshot() { return { t: this.timeMs, x: this.x, g: this.g }; }
  restore(s: { t: number; x: number; g: number }) { this.timeMs = s.t; this.x = s.x; this.g = s.g; }
  reset() { this.timeMs = 0; this.x = 0; this.g = 1; }
}

describe("Rng", () => {
  it("is deterministic per seed and restorable", () => {
    const a = new Rng(42), b = new Rng(42);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).toEqual(sb);
    const st = a.state;
    const n1 = a.next();
    a.state = st;
    expect(a.next()).toBe(n1);
  });
});

describe("RingBuffer", () => {
  it("overwrites oldest items and keeps order", () => {
    const r = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((v) => r.push(v));
    expect(r.toArray()).toEqual([3, 4, 5]);
    expect(r.at(0)).toBe(3);
    expect(r.last()).toBe(5);
    r.popWhile((v) => v > 4);
    expect(r.toArray()).toEqual([3, 4]);
  });
});

describe("SimulationRunner (deterministic clock)", () => {
  it("simulated time does not depend on the render frame rate", () => {
    const run = (frameMs: number) => {
      const r = new SimulationRunner(new Toy());
      r.play();
      let real = 0;
      while (r.timeMs < 2000) { r.tick(frameMs); real += frameMs; if (real > 1e6) break; }
      return r.timeMs === 2000 ? (r.engine as Toy).x : -1;
    };
    // 7 ms, 16.7 ms and 33 ms frames all reach exactly t = 2000 ms with identical state
    const a = run(5), b = run(10), c = run(25);
    expect(a).toBe(2000); expect(b).toBe(a); expect(c).toBe(a);
  });

  it("speed multiplies simulated time per real time", () => {
    const r = new SimulationRunner(new Toy());
    r.setSpeed(4); r.play();
    r.tick(100);
    expect(r.timeMs).toBe(400);
  });

  it("steps forward/backward and seeks deterministically with logged inputs", () => {
    const r = new SimulationRunner(new Toy(), { snapshotEveryMs: 100 });
    r.stepForward(100);          // t = 500
    r.dispatch({ g: 3 });
    r.stepForward(100);          // t = 1000
    const x1000 = (r.engine as Toy).x;
    r.seek(250);
    expect(r.timeMs).toBe(250);
    expect((r.engine as Toy).x).toBe(250);
    r.seek(1000);
    expect((r.engine as Toy).x).toBe(x1000);
    r.stepBackward(1);
    expect(r.timeMs).toBe(995);
  });

  it("a new input after rewinding discards the old future (branch)", () => {
    const r = new SimulationRunner(new Toy(), { snapshotEveryMs: 100 });
    r.dispatch({ g: 2 });
    r.stepForward(200);          // t = 1000, x = 2000
    r.seek(500);
    r.dispatch({ g: 1 });
    r.stepForward(100);          // t = 1000
    expect((r.engine as Toy).x).toBe(1000 + 500);
  });

  it("replay from the input log reproduces identical state", () => {
    const r = new SimulationRunner(new Toy(), { snapshotEveryMs: 100 });
    r.stepForward(50); r.dispatch({ g: 5 }); r.stepForward(80); r.dispatch({ g: -1 }); r.stepForward(70);
    const x = (r.engine as Toy).x, t = r.timeMs;
    r.replay(t);
    expect(r.timeMs).toBe(t);
    expect((r.engine as Toy).x).toBe(x);
  });
});
