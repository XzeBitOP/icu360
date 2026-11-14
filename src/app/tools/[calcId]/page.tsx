import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCalculators, getCalculator, getViews, getModules } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { Views, muted } from "@/components/ui";
import { Inline } from "@/components/Markdown";
import { CalculatorView } from "@/components/client/CalculatorView";
import { InfusionCalculator, InfusionTitle } from "@/components/client/InfusionCalculator";
import { SavedButton } from "@/components/client/SavedButton";
import { ViewTracker } from "@/components/client/Tracking";
import Link from "next/link";

type Params = { calcId: string };
export function generateStaticParams(): Params[] {
  return getCalculators().map((c) => ({ calcId: c.id }));
}
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const c = getCalculator((await params).calcId);
  return c ? { title: c.name, description: c.description } : {};
}

export default async function CalcPage({ params }: { params: Promise<Params> }) {
  const c = getCalculator((await params).calcId);
  if (!c) notFound();
  const views = getViews();
  const infusion = c.id === "infusion-rate-weight-min";
  const usedIn = getModules().flatMap((m) => m.topics.filter((t) => t.calculatorIds.includes(c.id) || (t.bedside.doseCards ?? []).some((d) => d.calculatorId === c.id)).map((t) => ({ m, t }))).slice(0, 6);
  return (
    <>
      <ViewTracker keys={[`tool:${c.id}`]} />
      <PageHeader
        backHref="/tools"
        eyebrow={infusion ? "Infusion calculator" : c.category === "score" ? "Score" : "Calculator"}
        title={infusion ? <InfusionTitle /> : c.name}
        right={<SavedButton item={{ href: `/tools/${c.id}`, title: infusion ? "Infusion calculator" : c.name, sub: c.category === "score" ? "Score" : "Calculator", icon: c.id === "gcs" ? "brain" : "calculator" }} />}
        meta={<div className="mt-3"><Views n={views.tools[c.id]} /></div>}
      />
      <Main className="space-y-5 max-w-[640px]">
        {infusion ? <InfusionCalculator /> : <CalculatorView calc={c} />}
        {c.notes ? <div className="glass rounded-[20px] px-4 py-3.5 text-[13.5px] leading-relaxed"><p className={`${muted} text-[12px] mb-1`}>Notes</p><Inline text={c.notes} /></div> : null}
        {c.references.length ? (
          <section className="glass rounded-[22px] p-4">
            <h2 className="display text-[15px] font-semibold mb-2">References</h2>
            <ol className="space-y-2 text-[13px] leading-[1.5]">
              {c.references.map((r, i) => <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.citation}</a></li>)}
            </ol>
          </section>
        ) : null}
        {usedIn.length ? (
          <section>
            <h2 className="display text-[16px] font-semibold mb-2 px-1">Used in</h2>
            <div className="flex flex-wrap gap-2">
              {usedIn.map(({ m, t }) => <Link key={`${m.id}/${t.id}`} href={`/m/${m.id}/${t.id}`} className="glass-chip rounded-full px-3 py-1.5 text-[12.5px] font-semibold">{t.title}</Link>)}
            </div>
          </section>
        ) : null}
        <p className={`text-[12px] ${muted} px-1 leading-relaxed`}>Calculators support, not replace, clinical judgement. Check inputs and units, and confirm doses with your unit protocol.</p>
      </Main>
    </>
  );
}
