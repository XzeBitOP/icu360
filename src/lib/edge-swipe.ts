/**
 * Left-edge swipe-to-go-back: pure gesture logic (no DOM), so it can be unit-tested.
 * A swipe must start within EDGE px of the left edge, travel right at least TRIGGER px,
 * and stay mostly horizontal. Vertical intent cancels it early so normal scrolling is untouched.
 */
export const EDGE = 20;
export const TRIGGER = 80;
/** after this much movement we decide the axis once */
export const SLOP = 10;
/** horizontal movement must be at least this many times the vertical movement */
export const RATIO = 1.5;

export type SwipeState = { active: false } | { active: true; x0: number; y0: number; dx: number; dy: number; locked: boolean };

export const IDLE: SwipeState = { active: false };

/** Routes where the gesture is off: Home has nowhere to go back to. */
export function swipeEnabledFor(pathname: string) {
  return pathname !== "/" && pathname !== "";
}

export function start(x: number, y: number, eligibleTarget: boolean): SwipeState {
  if (!eligibleTarget || x > EDGE || x < 0) return IDLE;
  return { active: true, x0: x, y0: y, dx: 0, dy: 0, locked: false };
}

export function move(s: SwipeState, x: number, y: number): SwipeState {
  if (!s.active) return s;
  const dx = x - s.x0;
  const dy = y - s.y0;
  if (!s.locked) {
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return { ...s, dx, dy };
    // decide once: vertical or leftward intent cancels the gesture
    if (dx <= 0 || Math.abs(dx) < Math.abs(dy) * RATIO) return IDLE;
    return { ...s, dx, dy, locked: true };
  }
  return { ...s, dx, dy };
}

/** 0..1 for the visual cue */
export function progress(s: SwipeState) {
  return s.active && s.locked ? Math.max(0, Math.min(1, s.dx / TRIGGER)) : 0;
}

export function shouldGoBack(s: SwipeState) {
  return s.active && s.locked && s.dx >= TRIGGER && Math.abs(s.dx) >= Math.abs(s.dy) * RATIO;
}
