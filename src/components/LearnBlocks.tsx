import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Faq, GuideLink, GuideSection } from "@/lib/learn";
import { IconTile, muted } from "./ui";
import { Icon } from "./Icon";
import { Block } from "./Markdown";

/** Hero-style call to action (same look as the Tools page's lead card). */
export function CtaCard({ link }: { link: GuideLink }) {
  return (
    <Link href={link.href} className="glass-hero rounded-[24px] p-4 flex items-center gap-3.5">
      <span className="w-12 h-12 rounded-[16px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
        <Icon name={link.icon} className="w-6 h-6" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="display font-semibold text-[17px] leading-snug">{link.title}</p>
        <p className="text-[12.5px] text-white/75 leading-snug">{link.sub}</p>
      </div>
      <ChevronRight className="w-5 h-5" aria-hidden="true" />
    </Link>
  );
}

export function LinkGrid({ title, links }: { title: string; links: GuideLink[] }) {
  if (!links.length) return null;
  return (
    <section>
      <h2 className="display text-[20px] font-semibold mb-2.5 px-1">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="glass rounded-[20px] p-3.5 flex items-center gap-3">
            <IconTile name={l.icon} size="w-9 h-9" isz="w-4 h-4" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[13.5px] truncate">{l.title}</p>
              <p className={`text-[12px] ${muted} truncate`}>{l.sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-400" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function GuideSections({ sections }: { sections: GuideSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="glass rounded-[24px] p-4 lg:p-5 scroll-mt-24">
          <h2 className="display text-[18px] font-semibold mb-1">{s.h}</h2>
          <Block text={s.body} className="text-[14.5px] leading-[1.6]" />
        </section>
      ))}
    </>
  );
}

/** FAQ as native <details> (works without JS; answers stay in the HTML for crawlers). */
export function FaqList({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  return (
    <section>
      <h2 className="display text-[20px] font-semibold mb-2.5 px-1">{title}</h2>
      <div className="space-y-2.5">
        {faqs.map((f) => (
          <details key={f.q} className="glass-strong rounded-[22px] group">
            <summary className="list-none cursor-pointer px-4 py-3.5 flex items-center gap-3">
              <h3 className="flex-1 min-w-0 font-semibold text-[15px] leading-snug">{f.q}</h3>
              <ChevronRight className="w-4 h-4 text-ink-400 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <p className="px-4 pb-4 text-[14px] leading-[1.55] text-ink-700 dark:text-night-text">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
