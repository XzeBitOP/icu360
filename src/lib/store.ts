"use client";
/**
 * Everything personal lives on the user's device (localStorage). No login, nothing sent anywhere.
 */
import { useSyncExternalStore } from "react";

export interface SavedItem { href: string; title: string; sub: string; icon: string }
export interface DailyRecord { score: number; total: number }
export interface StoreState {
  v: 1;
  opened: Record<string, number>; // "moduleId/topicId" -> first opened (ms)
  quiz: Record<string, number>; // moduleId -> best % (0–100)
  saved: SavedItem[];
  daily: { history: Record<string, DailyRecord>; streak: number; best: number; last: string | null };
}

const KEY = "icu360:v1";
const EMPTY: StoreState = { v: 1, opened: {}, quiz: {}, saved: [], daily: { history: {}, streak: 0, best: 0, last: null } };

let state: StoreState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    state = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      try {
        state = e.newValue ? { ...EMPTY, ...JSON.parse(e.newValue) } : EMPTY;
      } catch {
        state = EMPTY;
      }
      listeners.forEach((l) => l());
    }
  });
}

export function getState(): StoreState {
  load();
  return state;
}

export function update(fn: (s: StoreState) => StoreState) {
  load();
  state = fn(state);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Returns EMPTY during SSR/hydration, then the real device state (stable reference between updates). */
export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, () => EMPTY);
}

export function markOpened(moduleId: string, topicId: string) {
  const k = `${moduleId}/${topicId}`;
  if (getState().opened[k]) return;
  update((s) => ({ ...s, opened: { ...s.opened, [k]: Date.now() } }));
}

export function recordQuiz(moduleId: string, pct: number) {
  update((s) => ({ ...s, quiz: { ...s.quiz, [moduleId]: Math.max(s.quiz[moduleId] ?? 0, Math.round(pct)) } }));
}

export function toggleSaved(item: SavedItem) {
  update((s) => {
    const exists = s.saved.some((x) => x.href === item.href);
    return { ...s, saved: exists ? s.saved.filter((x) => x.href !== item.href) : [item, ...s.saved] };
  });
}

function prevDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

/** Record a finished daily set. Streak counts consecutive India-time days. */
export function recordDaily(date: string, score: number, total: number) {
  update((s) => {
    if (s.daily.history[date]) return s;
    const history = { ...s.daily.history, [date]: { score, total } };
    let streak = 1;
    if (s.daily.last === date) streak = s.daily.streak;
    else if (s.daily.last && prevDay(date) === s.daily.last) streak = s.daily.streak + 1;
    return { ...s, daily: { history, streak, best: Math.max(s.daily.best, streak), last: date } };
  });
}

export function currentStreak(s: StoreState, today: string): number {
  if (!s.daily.last) return 0;
  if (s.daily.last === today || s.daily.last === prevDay(today)) return s.daily.streak;
  return 0;
}

export function resetProgress() {
  update((s) => ({ ...EMPTY, saved: s.saved }));
}

export const PASS_MARK = 70;
