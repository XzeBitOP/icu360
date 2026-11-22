import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { guideJsonLd, pageMeta } from "@/lib/seo";
import { GUIDES, getGuide } from "@/lib/learn";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, muted } from "@/components/ui";
import { Inline } from "@/components/Markdown";
import { JsonLd } from "@/components/JsonLd";
import { CtaCard, FaqList, GuideSections, LinkGrid } from "@/components/LearnBlocks";

type Params = { slug: string };
export function generateStaticParams(): Params[] {
  return GUIDES.map((g) => ({ slug: g.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return {};
  return pageMeta({ title: g.metaTitle, description: g.description, path: g.path });
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter((x) => x.slug !== g.slug).map((x) => ({ href: x.path, title: x.h1, sub: x.eyebrow, icon: "book-open" }));
  return (
    <>
      <JsonLd data={guideJsonLd(g)} />
      <PageHeader backHref="/learn" eyebrow={g.eyebrow} title={g.h1} />
      <Main className="space-y-5 max-w-[860px]">
        <p className={`text-[15px] leading-relaxed ${muted} px-1`}><Inline text={g.intro} /></p>
        {g.cta ? <CtaCard link={g.cta} /> : null}
        <nav aria-label="On this page" className="glass rounded-[24px] p-4">
          <p className={`text-[12px] uppercase tracking-[.1em] font-semibold ${muted} mb-1.5`}>On this page</p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[14px] font-medium">
            {g.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-brand-700 dark:text-glow-teal">{s.h}</a></li>)}
          </ul>
        </nav>
        <GuideSections sections={g.sections} guideTitle={g.h1} />
        {g.cta ? <CtaCard link={g.cta} /> : null}
        <LinkGrid title="Go deeper on ICU 360" links={g.links} />
        <FaqList faqs={g.faqs} />
        <LinkGrid title="More free guides" links={[...others, { href: "/learn", title: "All ICU learning", sub: "Guides, simulators, calculators and quizzes", icon: "graduation-cap" }]} />
        <Callout kind="info" title="For learning">
          Written by Dr. Kenil Shah, critical care consultant, for interns, residents and ICU nurses. Numbers are common starting points from the ICU 360 modules and their references; always follow your unit&apos;s protocol and your seniors.
        </Callout>
      </Main>
    </>
  );
}
