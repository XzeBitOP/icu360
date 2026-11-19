import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { PageHeader, Main } from "@/components/Shell";
import { Views, muted } from "@/components/ui";
import { AbgInterpreter } from "@/components/client/AbgInterpreter";
import { SavedButton } from "@/components/client/SavedButton";
import { ViewTracker } from "@/components/client/Tracking";
import { getViews } from "@/lib/content";

export const metadata: Metadata = pageMeta({
  title: "ABG interpreter",
  description: "Stepwise arterial blood gas interpretation: primary disorder, compensation (Winter's), anion gap, albumin correction and delta ratio.",
  path: "/tools/abg",
});

export default function AbgPage() {
  return (
    <>
      <ViewTracker keys={["tool:abg"]} />
      <PageHeader backHref="/tools" eyebrow="Interactive tool" title="ABG interpreter" right={<SavedButton item={{ href: "/tools/abg", title: "ABG interpreter", sub: "Interactive tool", icon: "droplets" }} />} meta={<div className="mt-3"><Views n={getViews().tools["abg"]} /></div>} />
      <Main className="space-y-5 max-w-[720px]">
        <div data-no-swipe-back=""><AbgInterpreter /></div>
        <section className="glass rounded-[22px] p-4 text-[13px] leading-relaxed">
          <h2 className="display text-[15px] font-semibold mb-1.5">Rules used</h2>
          <ul className={`${muted} space-y-1 list-disc pl-4`}>
            <li>Normal: pH 7.35–7.45, pCO₂ 35–45 mmHg, HCO₃⁻ 22–26 mmol/L, anion gap 8–12 (no K⁺).</li>
            <li>Metabolic acidosis: expected pCO₂ = 1.5 × HCO₃⁻ + 8 ± 2 (Winter&apos;s). Metabolic alkalosis: 0.7 × HCO₃⁻ + 21 ± 2.</li>
            <li>Respiratory acidosis: HCO₃⁻ +1 (acute) or +3.5 (chronic) per 10 mmHg rise in pCO₂. Respiratory alkalosis: −2 (acute) or −5 (chronic) per 10 mmHg fall.</li>
            <li>Albumin-corrected AG = AG + 2.5 × (4 − albumin g/dL). Delta ratio = (AG − 12) ÷ (24 − HCO₃⁻).</li>
          </ul>
          <p className={`${muted} mt-2`}>Learn the approach in <Link href="/m/acid-base-abg/stepwise-interpretation" className="font-semibold text-brand-600 dark:text-glow-teal">Acid–base: stepwise interpretation</Link>. Educational tool; interpret with the clinical picture.</p>
        </section>
      </Main>
    </>
  );
}
