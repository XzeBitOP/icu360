"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useMounted } from "./useMounted";

export type ThemePref = "system" | "light" | "dark";

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
  if (meta) meta.content = dark ? "#05080F" : "#EAF0F5";
}

export function getPref(): ThemePref {
  try {
    const v = localStorage.getItem("icu360:theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setPref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem("icu360:theme");
    else localStorage.setItem("icu360:theme", pref);
  } catch {}
  applyTheme(pref);
  window.dispatchEvent(new Event("icu360:theme"));
}

export function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => {
      if (getPref() === "system") applyTheme("system");
      read();
    };
    mq.addEventListener("change", onSys);
    window.addEventListener("icu360:theme", read);
    return () => {
      mq.removeEventListener("change", onSys);
      window.removeEventListener("icu360:theme", read);
    };
  }, []);
  return dark;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useIsDark();
  return (
    <button
      type="button"
      onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`glass-btn blur-glass w-10 h-10 grid place-items-center rounded-full text-ink-700 dark:text-night-text ${className}`}
    >
      <Sun className="w-[19px] h-[19px] hidden dark:block" strokeWidth={2} aria-hidden="true" />
      <Moon className="w-[19px] h-[19px] block dark:hidden" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function ThemeSegment() {
  const [picked, setP] = useState<ThemePref | null>(null);
  const mounted = useMounted();
  const pref: ThemePref = picked ?? (mounted ? getPref() : "system");
  const opts: [ThemePref, string][] = [["system", "Device"], ["light", "Light"], ["dark", "Dark"]];
  return (
    <div className="seg grid grid-cols-3 gap-1 p-1 rounded-full" role="radiogroup" aria-label="Theme">
      {opts.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={pref === v} onClick={() => { setPref(v); setP(v); }}
          className={`py-2 rounded-full text-[13px] font-semibold ${pref === v ? "tab-active text-brand-700 dark:text-glow-teal" : "text-ink-500 dark:text-night-muted"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
