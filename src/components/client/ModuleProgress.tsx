"use client";
import { CircleCheck, Circle } from "lucide-react";
import { useStore, PASS_MARK } from "@/lib/store";
import { Ring } from "./Ring";

export function TopicTick({ moduleId, topicId }: { moduleId: string; topicId: string }) {
  const s = useStore();
  const on = !!s.opened[`${moduleId}/${topicId}`];
  return on ? <CircleCheck className="w-[19px] h-[19px] mt-0.5 text-ok dark:text-ok-bright shrink-0" strokeWidth={2} aria-label="Opened" /> : <Circle className="w-[19px] h-[19px] mt-0.5 text-ink-300 dark:text-night-faint shrink-0" strokeWidth={2} aria-label="Not opened yet" />;
}

export function ModuleProgress({ moduleId, total }: { moduleId: string; total: number }) {
  const s = useStore();
  const opened = Object.keys(s.opened).filter((k) => k.startsWith(`${moduleId}/`)).length;
  const best = s.quiz[moduleId];
  const passed = best !== undefined && best >= PASS_MARK;
  const done = opened >= total && passed;
  const pct = (Math.min(opened, total) / total) * 70 + (passed ? 30 : 0);
  return (
    <section className="glass rounded-[24px] p-4 flex items-center gap-4">
      <Ring pct={pct} size={64} stroke={7} label={done ? "✓" : `${Math.round(pct)}%`} />
      <div className="min-w-0">
        <p className="font-semibold text-[15px]">{done ? "Module complete" : "Your progress"}</p>
        <p className="text-[12.5px] text-ink-500 dark:text-night-muted mt-0.5">{Math.min(opened, total)}/{total} topics opened</p>
        <p className="text-[12.5px] text-ink-500 dark:text-night-muted">Quiz: {best === undefined ? "not taken" : `best ${best}%${passed ? " ✓" : ` (need ${PASS_MARK}%)`}`}</p>
      </div>
    </section>
  );
}
