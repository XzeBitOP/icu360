import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import { getModules, getTopic, refsById, getViews, getCalculator, getSections } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, Views, muted, IconTile } from "@/components/ui";
import { Block } from "@/components/Markdown";
import { Callouts, DoseCardView, RefsCard, StepsCard, TableView, drugFor } from "@/components/content";
import { TopicTabs } from "@/components/client/TopicTabs";
import { AlgorithmStepper } from "@/components/client/AlgorithmStepper";
import { SavedButton } from "@/components/client/SavedButton";
import { ShareButton } from "@/components/client/ShareButton";
import { ViewTracker, TopicOpened } from "@/components/client/Tracking";
import { prettyDate } from "@/lib/format";

type Params = { moduleId: string; topicId: string };

export function generateStaticParams(): Params[] {
  return getModules().flatMap((m) => m.topics.map((t) => ({ moduleId: m.id, topicId: t.id })));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { moduleId, topicId } = await params;
  const r = getTopic(moduleId, topicId);
  return r ? { title: `${r.topic.title} · ${r.module.title}`, description: r.topic.summary } : {};
}

export default async function TopicPage({ params }: { params: Promise<Params> }) {
  const { moduleId, topicId } = await params;
  const r = getTopic(moduleId, topicId);
  if (!r) notFound();
  const { module, topic } = r;
  const b = topic.bedside;
  const views = getViews();
  const idx = module.topics.findIndex((t) => t.id === topic.id);
  const prev = module.topics[idx - 1];
  const next = module.topics[idx + 1];
  const refs = refsById(module, topic.references);
  const calcs = topic.calculatorIds.map((id) => getCalculator(id)).filter((c) => !!c);
  const section = getSections().find((s) => s.id === module.section.id)!;
  const reviewed = module.lastReviewed ? `Reviewed ${prettyDate(module.lastReviewed.slice(0, 7))}` : "Draft";

  const meta = (
    <>
      <div className={`flex items-center flex-wrap gap-x-2 gap-y-1 mt-3 text-[12.5px] ${muted}`}>
        <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-ok dark:text-ok-bright" strokeWidth={2} aria-hidden="true" />{reviewed}</span>
        <span>·</span>
        <span>{refs.length} references</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Views n={views.topics[`${module.id}/${topic.id}`]} />
        <span className={`text-[11.5px] ${muted}`}>· views rounded down, updated weekly</span>
      </div>
    </>
  );

  const doseCards = (b.doseCards ?? []).map((c, i) => <DoseCardView key={`${c.drugId}-${i}`} card={c} drug={drugFor(module, c.drugId)} moduleId={module.id} />);

  const calcLinks = calcs.length ? (
    <section>
      <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Calculators for this topic</h2>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {calcs.map((c) => (
          <Link key={c!.id} href={`/tools/${c!.id}`} className="glass rounded-[20px] p-3.5 flex items-center gap-3">
            <IconTile name="calculator" size="w-9 h-9" isz="w-4 h-4" />
            <div className="min-w-0 flex-1"><p className="font-semibold text-[13.5px] truncate">{c!.name}</p><p className={`text-[12px] ${muted} truncate`}>{c!.description}</p></div>
            <ChevronRight className="w-4 h-4 text-ink-400" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  ) : null;

  const bedside = (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 xl:gap-6 items-start">
      <div className="space-y-5 min-w-0">
        {b.definition ? <Callout kind="info" title="Definition" text={b.definition.text} /> : null}
        <StepsCard steps={b.steps} title="At the bedside" />
        <div className="space-y-4 xl:hidden">{doseCards}</div>
        {(b.tables ?? []).map((t) => <TableView key={t.id} table={t} />)}
        <div className="space-y-4 xl:hidden"><Callouts b={b} which={["crit"]} /></div>
        <Callouts b={b} which={["warn"]} />
        <div className="space-y-4 xl:hidden"><Callouts b={b} which={["pearl"]} /></div>
        {calcLinks}
        <div className="xl:hidden"><RefsCard refs={refs} /></div>
      </div>
      <aside className="hidden xl:block space-y-4">
        {doseCards}
        <Callouts b={b} which={["crit", "pearl"]} />
        <RefsCard refs={refs} />
      </aside>
    </div>
  );

  const algorithm = topic.algorithm ? (
    <div className="space-y-4 max-w-[640px]">
      <h2 className="display text-[20px] font-semibold px-1">{topic.algorithm.title}</h2>
      <AlgorithmStepper algo={topic.algorithm} />
      <p className={`text-[12px] ${muted} leading-relaxed px-1`}>
        Based on {refsById(module, topic.algorithm.refs).map((x) => x.citation.split(/[.]/)[0]).join("; ") || "the references on the Bedside tab"}. Educational use; follow local protocol.
      </p>
    </div>
  ) : null;

  const cn = topic.consultantNotes;
  const noteSections: [string, string | undefined][] = [["Pathophysiology", cn.pathophysiology], ["Evidence", cn.evidence], ["Controversies", cn.controversies], ["India notes", cn.indiaNotes]];
  const notes = (
    <div className="space-y-4 max-w-[760px]">
      {noteSections.filter(([, v]) => v).map(([t, v]) => (
        <section key={t} className={`${t === "India notes" ? "callout warn pl-5" : "glass"} rounded-[24px] p-4 lg:p-5`}>
          {t === "India notes" ? <span className="bar bg-warn-bright" /> : null}
          <h2 className="display text-[18px] font-semibold mb-1">{t === "India notes" ? "🇮🇳 India notes" : t}</h2>
          <Block text={v!} className="text-[14.5px] leading-[1.6]" />
        </section>
      ))}
      <RefsCard refs={refs} />
    </div>
  );

  return (
    <>
      <ViewTracker keys={[topic.viewKey, module.viewKey]} />
      <TopicOpened moduleId={module.id} topicId={topic.id} />
      <div className="min-[1400px]:grid min-[1400px]:grid-cols-[230px_minmax(0,1fr)] min-[1400px]:gap-6 lg:pt-3">
        <nav className="hidden min-[1400px]:block glass rounded-[24px] p-3 self-start sticky top-4 mt-2" aria-label="Topics in this module">
          <Link href={`/m/${module.id}`} className="block px-2 pt-1 pb-2 text-[11px] uppercase tracking-[.1em] font-semibold text-ink-400 dark:text-night-faint">{module.title}</Link>
          <ul className="space-y-0.5">
            {module.topics.map((t) => (
              <li key={t.id}>
                <Link href={`/m/${module.id}/${t.id}`} aria-current={t.id === topic.id ? "page" : undefined}
                  className={`block px-3 py-2 rounded-[12px] text-[13px] ${t.id === topic.id ? "tab-active text-brand-700 dark:text-glow-teal font-semibold" : "text-ink-700 dark:text-night-text"}`}>
                  <p className="leading-snug">{t.title}</p>
                  <div className="mt-0.5"><Views n={views.topics[`${module.id}/${t.id}`]} className="text-[11px]" /></div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <PageHeader
            backHref={`/m/${module.id}`}
            eyebrow={<Link href={`/m/${module.id}`}><span className="hidden sm:inline">{section.title} · </span>{module.title}</Link>}
            title={topic.title}
            right={<><SavedButton item={{ href: `/m/${module.id}/${topic.id}`, title: topic.title, sub: module.title, icon: topic.algorithm ? "git-branch" : "file-text" }} /><ShareButton title={topic.title} /></>}
            meta={meta}
          />
          <Main className="space-y-5">
            <p className={`text-[14.5px] leading-relaxed ${muted} px-1 max-w-[760px]`}>{topic.summary}</p>
            <TopicTabs bedside={bedside} algorithm={algorithm} notes={notes} longLabels />
            <Link href={`/m/${module.id}/quiz`} className="glass-hero rounded-[26px] p-4 flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-[16px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
                <GraduationCap className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="flex-1"><p className="display font-semibold text-[17px]">Test yourself</p><p className="text-[13px] text-white/75">Module quiz · score 70% to complete the module</p></div>
              <ChevronRight className="w-5 h-5" strokeWidth={2.2} aria-hidden="true" />
            </Link>
            <div className="grid grid-cols-2 gap-3">
              {prev ? (
                <Link href={`/m/${module.id}/${prev.id}`} className="glass rounded-[20px] p-3.5">
                  <p className={`text-[11.5px] ${muted} flex items-center gap-1`}><ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />Previous</p>
                  <p className="font-semibold text-[13.5px] leading-snug mt-0.5 line-clamp-2">{prev.title}</p>
                </Link>
              ) : <span />}
              {next ? (
                <Link href={`/m/${module.id}/${next.id}`} className="glass rounded-[20px] p-3.5 text-right">
                  <p className={`text-[11.5px] ${muted} flex items-center justify-end gap-1`}>Next<ChevronRight className="w-3.5 h-3.5" aria-hidden="true" /></p>
                  <p className="font-semibold text-[13.5px] leading-snug mt-0.5 line-clamp-2">{next.title}</p>
                </Link>
              ) : <span />}
            </div>
            <p className={`text-[12px] leading-relaxed ${muted} px-1`}>Educational reference for trained clinicians. Check doses against your hospital protocol and the patient in front of you.</p>
          </Main>
        </div>
      </div>
    </>
  );
}
