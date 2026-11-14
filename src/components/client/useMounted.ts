"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** false during SSR and hydration, true afterwards. Lets components read browser-only values during render without effects. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
