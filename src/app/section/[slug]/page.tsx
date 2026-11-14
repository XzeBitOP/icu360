import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Eye, Search } from "lucide-react";
import { getSections, getViews, sectionViews } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { CircleLink, muted } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fmtViews } from "@/lib/format";
import { SectionModuleList } from "@/components/client/SectionModuleList";

type Params = { slug: string };
export function generateStaticParams(): Params[] {
  return getSections().map((s) => ({ slug: s.slug }));
}
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const s = getSections().find((x) => x.slug === slug);
  return s ? { title: s.title, description: s.tagline } : {};
}

export default async function SectionPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const s = getSections().find((x) => x.slug === slug);
  if (!s) notFound();
  const views = getViews();
  const sv = fmtViews(sectionViews(s));
  return (
    <>
      <PageHeader backHref="/browse" eyebrow={`Section ${s.letter}`} title={s.title} right={<CircleLink href="/search" label="Search"><Search className="w-[19px] h-[19px]" strokeWidth={2} aria-hidden="true" /></CircleLink>} />
      <Main className="space-y-4">
        <div className="glass-hero rounded-[26px] p-4 flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-[16px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
            <Icon name={s.icon} className="w-6 h-6" strokeWidth={2} />
          </span>
          <div className="flex-1">
            <p className="display font-semibold text-[18px]">{s.modules.length} modules · {s.topicCount} topics</p>
            <p className="text-[13px] text-white/75">{s.tagline}</p>
          </div>
          {sv !== "New" ? <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white/90"><Eye className="w-4 h-4" strokeWidth={2} aria-hidden="true" />{sv}</span> : null}
        </div>
        <SectionModuleList
          modules={s.modules.map((m) => ({
            id: m.id, n: m.number, title: m.title, topics: m.topics.map((t) => t.title).slice(0, 4).join(" · "), count: m.topics.length,
            algorithms: m.topics.some((t) => t.algorithm), views: views.modules[m.id] ?? 0,
          }))}
        />
        <p className={`text-[12px] ${muted} px-1 flex items-center gap-1.5`}><Eye className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />Views are rounded down to the nearest 1,000 and updated weekly.</p>
      </Main>
    </>
  );
}
