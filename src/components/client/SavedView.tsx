"use client";
import Link from "next/link";
import { Bookmark, ChevronRight, Trophy, X } from "lucide-react";
import { toggleSaved, useStore } from "@/lib/store";
import { badges } from "@/lib/progress";
import { ClientIcon } from "./icons";
import { ThemeSegment } from "./ThemeToggle";
import { Ring } from "./Ring";

const muted = "text-ink-500 dark:text-night-muted";

export function SavedView() {
  const s = useStore();
  const b = badges(s);
  const earned = b.badges.filter((x) => x.earned).length;
  return (
    <>
      <Link href="/progress" className="glass-strong rounded-[24px] p-4 flex items-center gap-4">
        <Ring pct={(b.completed / b.total) * 100} size={72} stroke={7} label={`${b.completed}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[16px]">Your progress</p>
          <p className={`text-[13px] ${muted}`}>{b.completed} of {b.total} modules complete · {earned} of 4 badges</p>
          <p className={`text-[12px] ${muted} mt-1 inline-flex items-center gap-1`}><Trophy className="w-3.5 h-3.5" aria-hidden="true" />Badges, phases and offline download</p>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-400" aria-hidden="true" />
      </Link>

      <section>
        <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Saved topics and tools</h2>
        {s.saved.length ? (
          <div className="glass-strong rounded-[22px] overflow-hidden">
            {s.saved.map((it, i) => (
              <div key={it.href} className={`flex items-center gap-3 pl-4 pr-2 py-3 ${i ? "border-t border-ink-200/60 dark:border-white/10" : ""}`}>
                <span className="glass-chip w-9 h-9 rounded-[12px] grid place-items-center text-brand-700 dark:text-glow-teal shrink-0"><ClientIcon name={it.icon} className="w-[18px] h-[18px]" /></span>
                <Link href={it.href} className="flex-1 min-w-0">
                  <p className="font-semibold text-[14.5px] truncate">{it.title}</p>
                  <p className={`text-[12.5px] ${muted} truncate`}>{it.sub}</p>
                </Link>
                <button type="button" aria-label={`Remove ${it.title}`} onClick={() => toggleSaved(it)} className="w-9 h-9 grid place-items-center rounded-full text-ink-400 hover:text-crit"><X className="w-4 h-4" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-[22px] p-5 flex gap-3">
            <Bookmark className="w-5 h-5 text-brand-600 dark:text-glow-teal shrink-0 mt-0.5" aria-hidden="true" />
            <p className={`text-[14px] ${muted}`}>Tap the bookmark on any topic or calculator to keep it here for the next shift. Nothing leaves your device.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Appearance</h2>
        <ThemeSegment />
      </section>
    </>
  );
}
