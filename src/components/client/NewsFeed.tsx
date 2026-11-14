"use client";
import Link from "next/link";
import { BookOpen, ExternalLink, Newspaper } from "lucide-react";
import { useState } from "react";
import type { NewsItem } from "@/lib/content";
import { prettyDate } from "@/lib/format";

const muted = "text-ink-500 dark:text-night-muted";
const tagCls: Record<string, string> = { Guideline: "text-brand-700 dark:text-glow-teal", Trial: "text-info dark:text-info-bright", India: "text-warn dark:text-warn-bright", "Drug safety": "text-crit dark:text-crit-bright", Definition: "text-pearl dark:text-pearl-bright", Review: "text-pearl dark:text-pearl-bright" };

export function NewsFeed({ items }: { items: (NewsItem & { moduleTitle?: string })[] }) {
  const tags = ["All", ...new Set(["Guidelines", "Trials", "India", "Drug safety"].concat(items.map((i) => i.tag)))].filter((t, i, a) => a.indexOf(t) === i);
  const map: Record<string, string> = { Guidelines: "Guideline", Trials: "Trial" };
  const [f, setF] = useState("All");
  const list = items.filter((i) => f === "All" || i.tag === (map[f] ?? f));
  return (
    <>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {tags.filter((t) => t !== "Guideline" && t !== "Trial").map((t) => (
          <button key={t} type="button" onClick={() => setF(t)} className={`${f === t ? "tab-active text-ink-900 dark:text-night-text" : `glass-chip ${muted}`} shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold`}>{t}</button>
        ))}
      </div>
      <p className={`text-[12px] ${muted} px-1`}>Newest first · every item links to its original source</p>
      {!items.length ? (
        <article className="glass-strong rounded-[24px] p-5">
          <span className="w-11 h-11 rounded-[14px] grid place-items-center text-white" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)" }}><Newspaper className="w-5 h-5" aria-hidden="true" /></span>
          <h3 className="display font-semibold text-[19px] leading-snug mt-3">Welcome to the ICU 360 news desk</h3>
          <p className={`text-[14px] ${muted} leading-[1.55] mt-1.5`}>Guideline changes, landmark trials and Indian ICU news will appear here. Every item is picked by a critical care consultant and links to the original source. The first updates land soon.</p>
        </article>
      ) : null}
      {list.map((n, i) => (
        <article key={n.id} className={`${i === 0 ? "glass-strong" : "glass"} rounded-[24px] p-4`}>
          <div className={`flex items-center gap-2 text-[12px] ${muted}`}>
            <span className={`glass-chip inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tagCls[n.tag] ?? "text-ink-700 dark:text-night-muted"}`}>{n.tag}</span>
            <span className="truncate">{n.source}</span>
            <span className="ml-auto font-mono whitespace-nowrap">{prettyDate(n.date)}</span>
          </div>
          <h3 className="display font-semibold text-[18px] leading-snug mt-2.5"><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a></h3>
          <p className={`text-[13.5px] ${muted} leading-[1.5] mt-1.5`}>{n.summary}</p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-200/60 dark:border-white/10 text-[12.5px]">
            {n.moduleId && n.moduleTitle ? (
              <Link href={`/m/${n.moduleId}`} className="flex items-center gap-1.5 text-brand-700 dark:text-glow-teal font-semibold min-w-0"><BookOpen className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /><span className="truncate">{n.moduleTitle}</span></Link>
            ) : <span />}
            <a href={n.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 ${muted} shrink-0 ml-3`}>Source<ExternalLink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" /></a>
          </div>
        </article>
      ))}
      {items.length > 0 && !list.length ? <p className={`glass rounded-[20px] p-4 text-[14px] ${muted}`}>No {f.toLowerCase()} items yet.</p> : null}
    </>
  );
}
