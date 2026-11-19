"use client";
import { useSyncExternalStore } from "react";
import { webglSupport } from "./stage";

let cached: { ok: boolean; low: boolean } | null = null;
const subscribe = () => () => {};
/** WebGL support + low-end heuristic. `null` during server render and hydration, then the (cached) client value. */
export function useWebgl(): { ok: boolean; low: boolean } | null {
  return useSyncExternalStore(subscribe, () => (cached ??= webglSupport()), () => null);
}
