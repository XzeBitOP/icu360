"use client";
import Link from "next/link";
import { FileText, GitBranch, Eye, Sparkles, CircleCheck } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { MODULES, moduleStatus } from "@/lib/progress";
import { fmtViews } from "@/lib/format";
import { SavedButton } from "./SavedButton";

interface Row { id: string; n: number; title: string; topics: string; count: number; algorithms: boolean; views: number }
const muted = "text-ink-500 dark:text-night-muted";

export function SectionModuleList({ modules }: { modules: Row[] }) {
  const [f, setF] = useState<"All" | "In progress" | "Saved">("All");
  const s = useStore();
  const rows = modules.filter((m) => {
    if (f === "Saved") return s.saved.some((x) => x.href === `/m/${m.id}`);
    if (f === "In progress") {
      const cm = MODULES.find((x) => x.id === m.id);
      return cm ? moduleStatus(s, cm).started : false;
    }
    return true;
  });
  return (
    <>
      <div className="seg inline-flex gap-1 p-1 rounded-full" role="radiogroup" aria-label="Filter modules">
        {(["All", "In progress", "Saved"] as const).map((x) => (
          <button key={x} role="radio" aria-checked={f === x} onClick={() => setF(x)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${f === x ? "tab-active text-ink-900 dark:text-night-text" : muted}`}>{x}</button>
        ))}
      </div>
      <ul className="space-y-3">
        {rows.map((m) => {
          const cm = MODULES.find((x) => x.id === m.id);
          const st = cm ? moduleStatus(s, cm) : null;
          const label = fmtViews(m.views);
          return (
            <li key={m.id}>
              <Link href={`/m/${m.id}`} className="glass rounded-[24px] p-4 block">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[12px] font-semibold text-ink-400 dark:text-night-faint w-6 pt-1">{String(m.n).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-[16px] leading-snug">{m.title}</h3>
                      <span className="flex items-center gap-2 mt-0.5">
                        {st?.complete ? <CircleCheck className="w-[19px] h-[19px] text-ok dark:text-ok-bright" strokeWidth={2} aria-label="Completed" /> : null}
                        <SavedButton variant="inline" item={{ href: `/m/${m.id}`, title: m.title, sub: `Module ${m.n}`, icon: "book-open" }} />
                      </span>
                    </div>
                    <p className={`text-[13px] ${muted} mt-1 leading-snug`}>{m.topics}</p>
                    <div className={`flex items-center gap-3 mt-3 text-[12px] ${muted}`}>
                      <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{m.count} topics</span>
                      {m.algorithms ? <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />Algorithms</span> : null}
                      {st && st.started && !st.complete ? <span className="text-brand-700 dark:text-glow-teal font-semibold">{st.opened}/{st.total}</span> : null}
                      <span className="ml-auto">
                        {label === "New" ? (
                          <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-ok dark:text-ok-bright"><Sparkles className="w-3 h-3" strokeWidth={2} aria-hidden="true" />New</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${muted} tnum`}><Eye className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{label}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
        {!rows.length ? <li className={`glass rounded-[24px] p-5 text-[14px] ${muted}`}>{f === "Saved" ? "No saved modules in this section yet. Tap the star on a module to save it." : "Nothing started here yet. Open a topic to begin."}</li> : null}
      </ul>
    </>
  );
}
