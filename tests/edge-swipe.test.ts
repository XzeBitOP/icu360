import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EDGE, IDLE, TRIGGER, move, progress, shouldGoBack, start, swipeEnabledFor, type SwipeState } from "../src/lib/edge-swipe";

const drag = (x0: number, y0: number, path: [number, number][], eligible = true) =>
  path.reduce<SwipeState>((s, [x, y]) => move(s, x, y), start(x0, y0, eligible));

describe("edge swipe-back gesture", () => {
  it("goes back on a mostly horizontal drag from the left edge past the trigger", () => {
    const s = drag(8, 300, [[20, 302], [60, 305], [8 + TRIGGER + 5, 310]]);
    expect(shouldGoBack(s)).toBe(true);
    expect(progress(s)).toBe(1);
  });

  it("ignores touches that start away from the edge", () => {
    expect(start(EDGE + 1, 300, true)).toEqual(IDLE);
    expect(shouldGoBack(drag(40, 300, [[200, 300]]))).toBe(false);
  });

  it("ignores touches on blocked targets (inputs, sliders, scrollers, tools)", () => {
    expect(shouldGoBack(drag(5, 300, [[200, 300]], false))).toBe(false);
  });

  it("cancels on vertical intent so page scrolling is untouched", () => {
    const s = drag(5, 300, [[12, 330], [100, 340]]);
    expect(s).toEqual(IDLE);
    expect(shouldGoBack(s)).toBe(false);
  });

  it("cancels on a leftward drag", () => {
    expect(drag(15, 300, [[2, 300]])).toEqual(IDLE);
  });

  it("does not trigger below the distance threshold", () => {
    const s = drag(5, 300, [[30, 300], [5 + TRIGGER - 1, 300]]);
    expect(shouldGoBack(s)).toBe(false);
    expect(progress(s)).toBeGreaterThan(0.9);
    expect(progress(s)).toBeLessThan(1);
  });

  it("does not trigger if the drag turns steeply diagonal after locking", () => {
    expect(shouldGoBack(drag(5, 300, [[30, 302], [100, 400]]))).toBe(false);
  });

  it("is disabled on Home only", () => {
    expect(swipeEnabledFor("/")).toBe(false);
    expect(swipeEnabledFor("/antimicrobials/meropenem")).toBe(true);
    expect(swipeEnabledFor("/tools/abg")).toBe(true);
  });
});

describe("safe-area wiring", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  it("uses viewport-fit=cover and pads the app by the top inset", () => {
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
    expect(css).toMatch(/--sat:\s*env\(safe-area-inset-top/);
    expect(css).toMatch(/\.app\s*\{[^}]*padding-top:\s*var\(--sat\)/);
    expect(css).toMatch(/\.tabbar\s*\{\s*bottom:\s*max\(1\.25rem,\s*var\(--sab\)\)/);
  });
  it("keeps the interactive tools out of the gesture", () => {
    for (const p of ["src/app/tools/ventilator/page.tsx", "src/app/tools/abg/page.tsx"]) expect(readFileSync(p, "utf8")).toContain("data-no-swipe-back");
  });
});
