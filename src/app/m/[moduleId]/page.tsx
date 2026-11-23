import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { ChevronRight, Clapperboard, GitBranch, GraduationCap, Pill } from "lucide-react";
import { topicsWithVisuals } from "@/lib/partners";
import { getModules, getModule, getViews, getSections } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { AiButton } from "@/components/client/ai/AiTutor";
import { ctx, moduleText } from "@/lib/ai/context";
import { Views, muted, Chip } from "@/components/ui";
import { Inline } from "@/components/Markdown";
import { RefsCard } from "@/components/content";
import { SavedButton } from "@/components/client/SavedButton";
import { ShareButton } from "@/components/client/ShareButton";
import { ViewTracker } from "@/components/client/Tracking";
import { ModuleProgress, TopicTick } from "@/components/client/ModuleProgress";
import { Icon } from "@/components/Icon";
import { practiceLinks } from "@/lib/learn";

type Params = { moduleId: string };
export function generateStaticParams(): Params[] {
  return getModules().map((m) => ({ moduleId: m.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const m = getModule((await params).moduleId);
  if (!m) return {};
  return pageMeta({
    title: m.title,
    description: m.summary,
    path: `/m/${m.id}`,
  });
}

export default async function ModulePage({ params }: { params: Promise<Params> }) {
  const m = getModule((await params).moduleId);
  if (!m) notFound();
  const views = getViews();
  const withVideo = topicsWithVisuals(m.id);
  const section = getSections().find((s) => s.id === m.section.id)!;
  const related = m.relatedModules.map((id) => getModule(id)).filter((x) => !!x);
  const quizCount = m.topics.reduce((n, t) => n + t.quiz.length, 0);
  const practice = practiceLinks(m.id);

  return (
    <>
      <ViewTracker keys={[m.viewKey]} />
      <PageHeader
        backHref={`/section/${section.slug}`}
        eyebrow={<Link href={`/section/${section.slug}`}>Module {m.number} · {section.title}</Link>}
        title={m.title}
        right={<><SavedButton item={{ href: `/m/${m.id}`, title: m.title, sub: `Module ${m.number}`, icon: "book-open" }} /><ShareButton title={m.title} /></>}
        meta={<div className="mt-3 flex items-center gap-2"><Views n={views.modules[m.id]} /><Chip>Phase {m.phase}</Chip></div>}
      />
      <Main className="space-y-6">
        <div className="flex items-start gap-3 px-1 max-w-[760px]">
          <p className={`text-[14.5px] leading-relaxed ${muted} flex-1`}>{m.summary}</p>
          <AiButton context={ctx("module", m.title, moduleText(m))} testId="ai-module" />
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <section>
              <h2 className="display text-[20px] font-semibold mb-3 px-1">{m.topics.length} topics</h2>
              <ul className="space-y-3">
                {m.topics.map((t, i) => (
                  <li key={t.id}>
                    <Link href={`/m/${m.id}/${t.id}`} className="glass rounded-[24px] p-4 flex items-start gap-3">
                      <span className="font-mono text-[12px] font-semibold text-ink-400 dark:text-night-faint w-6 pt-1">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-[16px] leading-snug">{t.title}</h3>
                          <TopicTick moduleId={m.id} topicId={t.id} />
                        </div>
                        <p className={`text-[13px] ${muted} mt-1 leading-snug line-clamp-2`}>{t.summary}</p>
                        <div className={`flex items-center gap-3 mt-3 text-[12px] ${muted}`}>
                          <span>{t.bedside.steps.length} steps</span>
                          {t.algorithm ? <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />Algorithm</span> : null}
                          {t.bedside.doseCards?.length ? <span className="flex items-center gap-1"><Pill className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{t.bedside.doseCards.length} doses</span> : null}
                          {withVideo.has(t.id) ? <span className="flex items-center gap-1" title="Visual explanation by Armando Hasudungan"><Clapperboard className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />Video</span> : null}
                          <span className="ml-auto"><Views n={views.topics[`${m.id}/${t.id}`]} /></span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {m.drugs.length ? (
              <section>
                <h2 className="display text-[20px] font-semibold mb-1 px-1">Drugs in this module</h2>
                <p className={`text-[12.5px] ${muted} mb-3 px-1`}>Doses written for this module&apos;s context. The same drug may read differently in another module.</p>
                <div className="space-y-2.5">
                  {m.drugs.map((d) => (
                    <details key={d.id} id={`drug-${d.id}`} className="glass-strong rounded-[22px] group scroll-mt-24">
                      <summary className="list-none cursor-pointer px-4 py-3.5 flex items-center gap-3">
                        <span className="w-9 h-9 rounded-[12px] grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)" }}><Pill className="w-4 h-4" strokeWidth={2} aria-hidden="true" /></span>
                        <div className="flex-1 min-w-0"><p className="font-semibold text-[15px]">{d.name}</p><p className={`text-[12px] ${muted} truncate`}>{d.class}</p></div>
                        <ChevronRight className="w-4 h-4 text-ink-400 transition-transform group-open:rotate-90" aria-hidden="true" />
                      </summary>
                      <dl className="px-4 pb-4 grid gap-2.5 text-[13.5px] leading-snug">
                        {([["Indications", d.indications], ["Adult dose", d.adultDose], ["Preparation (India)", d.preparationIndia], ["Renal / hepatic", d.renalHepatic], ["Cautions", d.cautions], ["Monitoring", d.monitoring]] as [string, string | undefined][])
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k}><dt className={`text-[12px] ${muted}`}>{k}</dt><dd className={k === "Adult dose" ? "font-medium text-brand-800 dark:text-glow-teal" : ""}><Inline text={v!} /></dd></div>
                          ))}
                      </dl>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4 sticky-safe">
            <ModuleProgress moduleId={m.id} total={m.topics.length} />
            <Link href={`/m/${m.id}/quiz`} className="glass-hero rounded-[26px] p-4 flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-[16px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}><GraduationCap className="w-6 h-6" strokeWidth={2} aria-hidden="true" /></span>
              <div className="flex-1"><p className="display font-semibold text-[17px]">Module quiz</p><p className="text-[13px] text-white/75">{quizCount} questions · pass mark 70%</p></div>
              <ChevronRight className="w-5 h-5" strokeWidth={2.2} aria-hidden="true" />
            </Link>
            {practice.length ? (
              <section className="glass rounded-[24px] p-4">
                <h2 className="display text-[16px] font-semibold mb-2">Practise interactively</h2>
                <ul>
                  {practice.map((l) => (
                    <li key={l.href}><Link href={l.href} className="flex items-center gap-2.5 py-2 text-[13.5px] font-medium"><Icon name={l.icon} className="w-4 h-4 text-brand-600 dark:text-glow-teal" /><span className="flex-1 min-w-0"><span className="block">{l.title.replace(/^Open /, "")}</span><span className={`block text-[12px] font-normal ${muted}`}>{l.sub}</span></span></Link></li>
                  ))}
                </ul>
              </section>
            ) : null}
            {related.length ? (
              <section className="glass rounded-[24px] p-4">
                <h2 className="display text-[16px] font-semibold mb-2">Related modules</h2>
                <ul>
                  {related.map((r) => (
                    <li key={r!.id}><Link href={`/m/${r!.id}`} className="flex items-center gap-2.5 py-2 text-[13.5px] font-medium"><Icon name={r!.uiHints.icon} className="w-4 h-4 text-brand-600 dark:text-glow-teal" />{r!.title}</Link></li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
        <RefsCard refs={m.references} title={`Module references (${m.references.length})`} />
      </Main>
    </>
  );
}
