import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { ChevronRight, Search } from "lucide-react";
import { getSections, sectionViews, getViews } from "@/lib/content";
import { ROWS as ANTIMICROBIALS } from "@/lib/antimicrobials";
import { PageHeader, Main } from "@/components/Shell";
import { CircleLink, IconTile, Views, muted } from "@/components/ui";

export const metadata: Metadata = pageMeta({
  title: "Browse all modules",
  description: "Browse all 40 ICU modules across 11 sections — resuscitation, airway, cardiovascular, renal, neuro, infections, toxicology and more.",
  path: "/browse",
});

export default function Browse() {
  const sections = getSections();
  const views = getViews();
  const total = sections.reduce((n, s) => n + s.modules.length, 0);
  return (
    <>
      <PageHeader back={false} eyebrow={`${total} modules · ${sections.length} sections`} title="Browse" right={<CircleLink href="/search" label="Search"><Search className="w-[19px] h-[19px]" strokeWidth={2} aria-hidden="true" /></CircleLink>} />
      <Main className="space-y-7">
        <Link href="/antimicrobials" className="glass rounded-[24px] p-4 flex items-center gap-3.5">
          <IconTile name="pill" size="w-12 h-12" isz="w-6 h-6" />
          <div className="flex-1 min-w-0">
            <p className="display font-semibold text-[17px] leading-snug">Antimicrobials</p>
            <p className={`text-[12.5px] ${muted} leading-snug`}>{ANTIMICROBIALS.length} drugs · doses, renal adjustment, Indian brands</p>
          </div>
          <ChevronRight className="w-5 h-5 text-ink-400 shrink-0" aria-hidden="true" />
        </Link>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/tools/ecg-os" className="glass rounded-[24px] p-4 flex items-center gap-3.5">
            <IconTile name="heart-pulse" size="w-12 h-12" isz="w-6 h-6" />
            <div className="flex-1 min-w-0">
              <p className="display font-semibold text-[17px] leading-snug">ECG OS</p>
              <p className={`text-[12.5px] ${muted} leading-snug`}>Simulator · 12-lead, 3D heart, conduction</p>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-400 shrink-0" aria-hidden="true" />
          </Link>
          <Link href="/tools/ventilator-os" className="glass rounded-[24px] p-4 flex items-center gap-3.5">
            <IconTile name="gauge" size="w-12 h-12" isz="w-6 h-6" />
            <div className="flex-1 min-w-0">
              <p className="display font-semibold text-[17px] leading-snug">Ventilator OS</p>
              <p className={`text-[12.5px] ${muted} leading-snug`}>Simulator · waveforms, 3D lungs, scenarios</p>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-400 shrink-0" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {sections.map((s) => (
            <Link key={s.id} href={`/section/${s.slug}`} className="glass rounded-[24px] p-4 min-h-[128px] flex flex-col">
              <IconTile name={s.icon} />
              <p className="font-semibold text-[14px] leading-snug mt-3">{s.title}</p>
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className={`text-[12px] ${muted}`}>{s.modules.length} modules</span>
                <Views n={sectionViews(s)} />
              </div>
            </Link>
          ))}
        </div>
        {sections.map((s) => (
          <section key={s.id}>
            <div className="flex items-baseline justify-between mb-2.5 px-1">
              <h2 className="display text-[19px] font-semibold"><span className="text-brand-600 dark:text-glow-teal mr-1.5">{s.letter}</span>{s.title}</h2>
              <Link href={`/section/${s.slug}`} className="text-[13px] font-semibold text-brand-600 dark:text-glow-teal">Open</Link>
            </div>
            <ul className="glass rounded-[24px] divide-y divide-ink-200/60 dark:divide-white/10">
              {s.modules.map((m) => (
                <li key={m.id}>
                  <Link href={`/m/${m.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="font-mono text-[12px] font-semibold text-ink-400 dark:text-night-faint w-6">{String(m.number).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0 text-[14.5px] font-medium leading-snug">{m.title}</span>
                    <span className={`text-[12px] ${muted} whitespace-nowrap`}>{m.topics.length} topics</span>
                    <Views n={views.modules[m.id]} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Main>
    </>
  );
}
