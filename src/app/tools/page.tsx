import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { getCalculators, getViews } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { IconTile, Views, muted } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Tools and calculators" };

const CAT: Record<string, [string, string]> = {
  infusion: ["Infusions", "syringe"], "body-size": ["Body size", "ruler"], ventilation: ["Ventilation & oxygen", "wind"], "acid-base": ["Acid–base", "flask-conical"],
  electrolytes: ["Electrolytes", "beaker"], renal: ["Renal", "filter"], haemodynamics: ["Haemodynamics", "activity"], cardiac: ["Cardiac", "heart"], fluids: ["Fluids", "droplets"],
  score: ["Scores", "list-checks"], toxicology: ["Toxicology", "skull"], dosing: ["Dosing", "pill"], other: ["Other", "calculator"],
};

export default function Tools() {
  const calcs = getCalculators();
  const views = getViews();
  const featured = [
    { href: "/tools/infusion-rate-weight-min", icon: "calculator", t: "Infusion calculator", s: "Noradrenaline, adrenaline, dobutamine… mcg/kg/min ↔ mL/h", id: "infusion-rate-weight-min" },
    { href: "/tools/abg", icon: "droplets", t: "ABG interpreter", s: "Stepwise: compensation, anion gap, delta ratio", id: "abg" },
    { href: "/tools/ventilator", icon: "gauge", t: "Ventilator playground", s: "Move the dials, watch the waveforms", id: "ventilator" },
    { href: "/tools/code-timer", icon: "timer", t: "Code timer", s: "CPR cycles, adrenaline and shock log", id: "code-timer" },
    { href: "/tools/gcs", icon: "brain", t: "Glasgow Coma Scale", s: "E · V · M", id: "gcs" },
  ];
  const cats = [...new Set(calcs.map((c) => c.category))];
  return (
    <>
      <PageHeader back={false} eyebrow={`${calcs.length} calculators · 3 interactive tools`} title="Tools" />
      <Main className="space-y-7">
        <section className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {featured.map((f, i) => (
            <Link key={f.href} href={f.href} className={`${i === 0 ? "glass-hero sm:col-span-2 xl:col-span-1" : "glass"} rounded-[24px] p-4 flex items-center gap-3.5`}>
              {i === 0 ? (
                <span className="w-12 h-12 rounded-[16px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}><Icon name={f.icon} className="w-6 h-6" strokeWidth={2} /></span>
              ) : (
                <IconTile name={f.icon} size="w-12 h-12" isz="w-6 h-6" />
              )}
              <div className="flex-1 min-w-0">
                <p className="display font-semibold text-[17px] leading-snug">{f.t}</p>
                <p className={`text-[12.5px] ${i === 0 ? "text-white/75" : muted} leading-snug`}>{f.s}</p>
              </div>
              {i === 0 ? <ChevronRight className="w-5 h-5" aria-hidden="true" /> : <Views n={views.tools[f.id]} />}
            </Link>
          ))}
        </section>
        {cats.map((cat) => (
          <section key={cat}>
            <h2 className="display text-[19px] font-semibold mb-2.5 px-1 flex items-center gap-2"><Icon name={CAT[cat]?.[1] ?? "calculator"} className="w-[18px] h-[18px] text-brand-600 dark:text-glow-teal" strokeWidth={2} />{CAT[cat]?.[0] ?? cat}</h2>
            <ul className="glass rounded-[24px] divide-y divide-ink-200/60 dark:divide-white/10">
              {calcs.filter((c) => c.category === cat).map((c) => (
                <li key={c.id}>
                  <Link href={`/tools/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14.5px] leading-snug">{c.name}</p>
                      <p className={`text-[12.5px] ${muted} truncate`}>{c.description}</p>
                    </div>
                    <Views n={views.tools[c.id]} />
                    <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" aria-hidden="true" />
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
