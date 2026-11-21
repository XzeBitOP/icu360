import type { Metadata } from "next";
import { breadcrumbJsonLd, faqJsonLd, pageMeta, SITE_ORIGIN } from "@/lib/seo";
import { GUIDES, ICU_FAQS } from "@/lib/learn";
import { getCalculators, getModules } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { muted } from "@/components/ui";
import { JsonLd } from "@/components/JsonLd";
import { CtaCard, FaqList, LinkGrid } from "@/components/LearnBlocks";

const DESCRIPTION = "Free ICU learning for interns, junior doctors and ICU nurses: beginner guides to mechanical ventilation, ECG and ABG, interactive ventilator and ECG simulators, ICU calculators and a daily quiz. By critical care consultant Dr. Kenil Shah.";

export const metadata: Metadata = pageMeta({
  title: "ICU learning for interns and residents: free guides and simulators",
  description: DESCRIPTION,
  path: "/learn",
});

export default function LearnHub() {
  const modules = getModules();
  const topics = modules.reduce((n, m) => n + m.topics.length, 0);
  const calcs = getCalculators().length;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: "Learn critical care",
              description: DESCRIPTION,
              url: `${SITE_ORIGIN}/learn`,
              inLanguage: "en-IN",
              isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
              author: { "@id": `${SITE_ORIGIN}/#kenil-shah` },
              hasPart: GUIDES.map((g) => ({ "@type": "LearningResource", name: g.h1, url: `${SITE_ORIGIN}${g.path}` })),
            },
            breadcrumbJsonLd([{ name: "ICU 360", path: "/" }, { name: "Learn", path: "/learn" }]),
            faqJsonLd(ICU_FAQS),
          ],
        }}
      />
      <PageHeader eyebrow="Free ICU learning" title="Learn critical care" />
      <Main className="space-y-6 max-w-[860px]">
        <p className={`text-[15px] leading-relaxed ${muted} px-1`}>
          ICU 360 is a free ICU guide for interns, junior doctors, residents and ICU nurses, written by Dr. Kenil Shah, a critical care consultant. Start with a short guide, then practise it in a simulator: {modules.length} ICU modules, {topics} bedside topics, {calcs} ICU calculators, and interactive ventilator and ECG simulators, all free with no sign-up.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <CtaCard link={{ href: "/tools/ventilator-os", title: "Ventilator OS", sub: "Free mechanical ventilation simulator", icon: "gauge" }} />
          <CtaCard link={{ href: "/tools/ecg-os", title: "ECG OS", sub: "Free interactive ECG simulator", icon: "heart-pulse" }} />
        </div>
        <LinkGrid title="Beginner guides" links={GUIDES.map((g) => ({ href: g.path, title: g.h1, sub: g.description.split(":")[0], icon: "book-open" }))} />
        <LinkGrid
          title="Practise and look things up"
          links={[
            { href: "/tools/abg", title: "ABG interpreter", sub: "Stepwise ABG interpretation calculator", icon: "droplets" },
            { href: "/tools", title: `${calcs} ICU calculators`, sub: "P/F ratio, driving pressure, SOFA, GCS, NEWS2…", icon: "calculator" },
            { href: "/browse", title: `${modules.length} ICU modules`, sub: "Sepsis, ARDS, shock, AKI, toxicology and more", icon: "book-open" },
            { href: "/quiz", title: "Daily ICU quiz", sub: "Five questions a day, with explanations", icon: "graduation-cap" },
            { href: "/tools/code-timer", title: "Code timer", sub: "CPR cycles, adrenaline and rhythm checks", icon: "timer" },
            { href: "/antimicrobials", title: "Antimicrobials guide", sub: "ICU doses, renal adjustment, Indian brands", icon: "pill" },
            { href: "/news", title: "Critical care news", sub: "New trials and guidelines, with sources", icon: "newspaper" },
          ]}
        />
        <FaqList faqs={ICU_FAQS} title="About ICU 360" />
      </Main>
    </>
  );
}
