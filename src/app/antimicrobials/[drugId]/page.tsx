import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { drugJsonLd, pageMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Syringe } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, Chip, muted } from "@/components/ui";
import { SavedButton } from "@/components/client/SavedButton";
import { ShareButton } from "@/components/client/ShareButton";
import { ANTIMICROBIALS, getAntimicrobial, generationOf, isInvestigational } from "@/lib/antimicrobials";

type Params = { drugId: string };
export function generateStaticParams(): Params[] {
  return ANTIMICROBIALS.map((a) => ({ drugId: a.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const a = getAntimicrobial((await params).drugId);
  if (!a) return {};
  return pageMeta({
    title: a.name,
    description: `${a.name} (${a.drugClass}): spectrum, indications, adult and ICU dose, renal and hepatic adjustment, Indian brands.`,
    path: `/antimicrobials/${a.id}`,
  });
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-[24px] p-4 lg:p-5">
      <h2 className="display text-[17px] font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className={`text-[14px] ${muted}`}>None listed.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x} className="flex gap-2.5 text-[14px] leading-[1.5]"><span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-glow-teal shrink-0" aria-hidden="true" />{x}</li>
      ))}
    </ul>
  );
}

function DoseRow({ label, value, strong, first }: { label: string; value: string | null; strong?: boolean; first?: boolean }) {
  return (
    <div className={`px-4 py-3 ${first ? "" : "border-t border-ink-200/70 dark:border-white/10"}`}>
      <dt className={`${muted} text-[12px]`}>{label}</dt>
      <dd className={`mt-0.5 text-[14px] leading-snug ${value ? (strong ? "font-mono font-semibold text-[14.5px] text-brand-700 dark:text-glow-teal" : "font-medium") : muted}`}>{value ?? "No specific guidance in source — see label."}</dd>
    </div>
  );
}

export default async function AntimicrobialPage({ params }: { params: Promise<Params> }) {
  const a = getAntimicrobial((await params).drugId);
  if (!a) notFound();
  const inv = isInvestigational(a);
  const gen = generationOf(a.subclass);
  return (
    <>
      <JsonLd data={drugJsonLd(a)} />
      <PageHeader
        backHref="/antimicrobials"
        eyebrow={<Link href="/antimicrobials">{a.category} · {a.drugClass}</Link>}
        title={a.name}
        right={<><SavedButton item={{ href: `/antimicrobials/${a.id}`, title: a.name, sub: a.drugClass, icon: "pill" }} /><ShareButton title={a.name} /></>}
        meta={
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {inv ? <Chip className="text-warn dark:text-warn-bright">Investigational</Chip> : null}
            <Chip>{a.subclass}</Chip>
            {gen && !a.subclass.toLowerCase().startsWith(gen) ? <Chip>{gen}</Chip> : null}
            {a.route.map((r) => <Chip key={r} className="text-brand-700 dark:text-glow-teal">{r}</Chip>)}
          </div>
        }
      />
      <Main className="space-y-4 max-w-[760px]">
        <Callout kind="warn" title="Verify before prescribing" text="Verify doses against local formulary and current labels." />
        {inv ? (
          <Callout kind="info" title="Investigational" text={`${a.approvalStatus}. Not approved for clinical use, so no dose is given.`} />
        ) : (
          <section className="glass-strong rounded-[24px] overflow-hidden">
            <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-ink-200/70 dark:border-white/10">
              <span className="w-10 h-10 rounded-[14px] grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
                <Syringe className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
              </span>
              <h2 className="display text-[18px] font-semibold">Dosing</h2>
              {a.approvalStatus.startsWith("Approved") ? null : <Chip className="ml-auto text-warn dark:text-warn-bright">{a.approvalStatus}</Chip>}
            </div>
            <dl>
              <DoseRow first label="Adult dose" value={a.dose.adult} strong />
              <DoseRow label="Severe infection / ICU" value={a.dose.severeICU} strong />
              <DoseRow label="Renal adjustment" value={a.dose.renal} />
              <DoseRow label="Hepatic adjustment" value={a.dose.hepatic} />
            </dl>
          </section>
        )}
        <Card title="Spectrum"><p className="text-[14px] leading-[1.55]">{a.spectrum}</p></Card>
        <Card title="Indications"><Bullets items={a.indications} /></Card>
        <Card title="Contraindications"><Bullets items={a.contraindications} /></Card>
        <Card title="Cautions"><Bullets items={a.cautions} /></Card>
        <Card title="Availability in India">
          <p className="text-[14px] font-medium leading-snug">{a.indiaAvailability}</p>
          {a.approvalStatus !== "Approved" ? <p className={`text-[13px] ${muted} mt-1 leading-relaxed`}>Regulatory status: {a.approvalStatus}</p> : null}
          {a.availabilityNote ? <p className={`text-[13px] ${muted} mt-1 leading-relaxed`}>{a.availabilityNote}</p> : null}
          {a.brandsIndia.length ? (
            <div className="mt-3">
              <p className={`text-[12px] ${muted} mb-1.5`}>Brands</p>
              <div className="flex flex-wrap gap-1.5">{a.brandsIndia.map((b) => <Chip key={b}>{b}</Chip>)}</div>
            </div>
          ) : null}
          {a.aliases.length ? <p className={`text-[12.5px] ${muted} mt-3`}>Also known as: {a.aliases.join(", ")}</p> : null}
        </Card>
        <Card title="References">
          <ol className="space-y-1.5">
            {a.references.map((r) => (
              <li key={r.code} className="text-[13.5px] leading-snug"><span className="font-mono text-[12px] font-semibold text-brand-700 dark:text-glow-teal mr-2">{r.code}</span>{r.source}</li>
            ))}
          </ol>
        </Card>
        <p className={`text-[12px] ${muted} px-1 leading-relaxed`}>Educational reference for clinicians. Doses are for adults with normal organ function unless stated. Verify doses against local formulary and current labels.</p>
      </Main>
    </>
  );
}
