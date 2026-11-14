"use client";
import { ListChecks, GitBranch, BookOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMounted } from "./useMounted";
import { motion } from "framer-motion";

type Tab = "bedside" | "algorithm" | "notes";

export function TopicTabs({ bedside, algorithm, notes, longLabels = false }: { bedside: ReactNode; algorithm: ReactNode | null; notes: ReactNode; longLabels?: boolean }) {
  const [picked, setTab] = useState<Tab | null>(null);
  const mounted = useMounted();
  const hash = mounted ? window.location.hash.replace("#", "") : "";
  const tab: Tab = picked ?? (hash === "algorithm" && algorithm ? "algorithm" : hash === "notes" ? "notes" : "bedside");
  const tabs: [Tab, string, typeof ListChecks][] = [["bedside", "Bedside", ListChecks], ...(algorithm ? ([["algorithm", "Algorithm", GitBranch]] as [Tab, string, typeof ListChecks][]) : []), ["notes", longLabels ? "Consultant notes" : "Notes", BookOpen]];
  const select = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "bedside" ? window.location.pathname : `#${t}`);
  };
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Topic layers" className={`seg grid ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-1 p-1 rounded-[18px] max-w-[520px]`}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => select(id)}
            className={`relative flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] text-[13px] font-semibold ${tab === id ? "text-brand-700 dark:text-glow-teal" : "text-ink-500 dark:text-night-muted"}`}>
            {tab === id ? <motion.span layoutId="tab-pill" className="absolute inset-0 tab-active rounded-[14px]" transition={{ type: "spring", stiffness: 500, damping: 38 }} /> : null}
            <Icon className="relative w-4 h-4" strokeWidth={2} aria-hidden="true" />
            {id === "notes" && longLabels ? (
              <span className="relative"><span className="sm:hidden">Notes</span><span className="hidden sm:inline">{label}</span></span>
            ) : <span className="relative">{label}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" hidden={tab !== "bedside"}>{bedside}</div>
      {algorithm ? <div role="tabpanel" hidden={tab !== "algorithm"}>{algorithm}</div> : null}
      <div role="tabpanel" hidden={tab !== "notes"}>{notes}</div>
    </div>
  );
}
