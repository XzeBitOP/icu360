"use client";
import Link from "next/link";
import { Star, Eye, Sparkles, Medal, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { badges } from "@/lib/progress";
import { fmtViews } from "@/lib/format";
import { clientIcon } from "./icons";

function ViewsC({ n }: { n?: number }) {
  const label = fmtViews(n);
  if (label === "New")
    return (
      <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-ok dark:text-ok-bright whitespace-nowrap">
        <Sparkles className="w-3 h-3" strokeWidth={2} aria-hidden="true" />New
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-500 dark:text-night-muted whitespace-nowrap tnum">
      <Eye className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{label}
    </span>
  );
}

export interface FavDefault { href: string; title: string; sub: string; icon: string }

export function HomeFavourites({ defaults, views, variant }: { defaults: FavDefault[]; views: Record<string, number>; variant: "scroll" | "list" }) {
  const s = useStore();
  const items = s.saved.length ? s.saved : defaults;
  const saved = s.saved.length > 0;
  const header = (
    <div className={`flex items-baseline justify-between ${variant === "scroll" ? "mb-3 px-1" : "mb-2"}`}>
      <h2 className={`display font-semibold ${variant === "scroll" ? "text-[20px]" : "text-[17px]"}`}>{saved ? "Favourites" : "Suggested"}</h2>
      <Link href="/saved" className={`${variant === "scroll" ? "text-[13px]" : "text-[12.5px]"} font-semibold text-brand-600 dark:text-glow-teal`}>{saved ? "Edit" : "How to save"}</Link>
    </div>
  );
  if (variant === "list")
    return (
      <section className="glass rounded-[26px] p-5">
        {header}
        <ul>
          {items.slice(0, 6).map((f) => {
            const I = clientIcon(f.icon);
            return (
              <li key={f.href}>
                <Link href={f.href} className="flex items-center gap-3 py-2.5">
                  <span className="glass-btn w-9 h-9 rounded-[14px] grid place-items-center text-brand-700 dark:text-glow-teal"><I className="w-4 h-4" strokeWidth={1.9} aria-hidden="true" /></span>
                  <div className="flex-1 min-w-0"><p className="text-[13.5px] font-semibold truncate">{f.title}</p><p className="text-[12px] text-ink-500 dark:text-night-muted truncate">{f.sub}</p></div>
                  <ViewsC n={views[f.href]} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  return (
    <section>
      {header}
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
        {items.map((f) => {
          const I = clientIcon(f.icon);
          return (
            <Link key={f.href} href={f.href} className="glass shrink-0 w-[158px] rounded-[24px] p-4">
              <div className="flex items-center justify-between">
                <span className="glass-btn w-10 h-10 rounded-[14px] grid place-items-center text-brand-700 dark:text-glow-teal"><I className="w-5 h-5" strokeWidth={1.9} aria-hidden="true" /></span>
                <Star className={`w-4 h-4 ${saved ? "text-warn-bright fill-current" : "text-ink-300 dark:text-night-faint"}`} strokeWidth={2} aria-hidden="true" />
              </div>
              <p className="font-semibold text-[15px] mt-3.5 leading-snug line-clamp-2">{f.title}</p>
              <p className="text-[12px] text-ink-500 dark:text-night-muted truncate">{f.sub}</p>
              <div className="mt-2.5"><ViewsC n={views[f.href]} /></div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** "Your progress" card. The Daily Quiz itself now lives in the highlighted spotlight at the top of Home. */
export function ProgressCard() {
  const s = useStore();
  const { completed, total, badges: b } = useMemo(() => badges(s), [s]);
  const earned = b.filter((x) => x.earned).length;
  return (
    <Link href="/progress" className="glass rounded-[24px] p-4 flex items-center gap-3">
      <span className="w-10 h-10 rounded-[14px] grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
        <Medal className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14px] leading-snug">Your progress</p>
        <p className="text-[12px] text-ink-500 dark:text-night-muted tnum">{completed}/{total} modules · {earned} badge{earned === 1 ? "" : "s"}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-ink-400 dark:text-night-muted" aria-hidden="true" />
    </Link>
  );
}
