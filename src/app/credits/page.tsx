import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Heart, Clapperboard, ChevronRight } from "lucide-react";
import { pageMeta } from "@/lib/seo";
import { PageHeader, Main } from "@/components/Shell";
import { Chip, muted, gradBtn } from "@/components/ui";
import { getArmando } from "@/lib/partners";
import { getModules } from "@/lib/content";

export const metadata: Metadata = pageMeta({
  title: "Partners and credits",
  description: "The people whose work makes ICU 360 better. Visual explanations by Armando Hasudungan (armandoh.org), shared with permission.",
  path: "/credits",
});

export default function CreditsPage() {
  const { partner, videos } = getArmando();
  const modules = getModules();
  const byModule = modules
    .map((m) => ({ m, items: videos.filter((v) => v.icuModuleId === m.id) }))
    .filter((x) => x.items.length);
  const uniqueVideos = new Set(videos.map((v) => v.youtubeId)).size;
  const topics = new Set(videos.map((v) => `${v.icuModuleId}/${v.icuTopicId}`)).size;

  return (
    <>
      <PageHeader eyebrow="Thank you" title="Partners & credits" />
      <Main className="space-y-6 max-w-[760px]">
        <section className="glass rounded-[26px] p-4 lg:p-5" data-testid="credit-armando">
          <div className="flex items-start gap-3.5">
            <span className="w-12 h-12 rounded-[16px] grid place-items-center text-white shrink-0" style={gradBtn} aria-hidden="true">
              <Clapperboard className="w-6 h-6" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-brand-600 dark:text-glow-teal">Visual explanations</p>
              <h2 className="display text-[22px] font-semibold leading-snug">{partner.name}</h2>
              <p className={`text-[14px] leading-[1.55] mt-1 ${muted}`}>
                Medical illustrator whose hand-drawn videos are loved by medical students worldwide for making physiology and disease easy to picture. His videos appear on {topics} ICU 360 topics with his kind permission.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href={partner.site} target="_blank" rel="noopener" className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-white font-semibold text-[14px]" style={gradBtn} data-testid="credit-site">
              Visit armandoh.org<ExternalLink className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </a>
            <a href={partner.youtube} target="_blank" rel="noopener" className="glass-btn inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[14px] text-ink-900 dark:text-night-text">
              YouTube channel<ExternalLink className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </a>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[14px] leading-[1.5] font-medium text-ink-900 dark:text-night-text">
            <Heart className="w-4 h-4 mt-0.5 shrink-0 text-crit dark:text-crit-bright fill-current" strokeWidth={2} aria-hidden="true" />
            Thank you, Armando, for letting ICU 360 share your work with critical care learners in India and beyond.
          </p>
          <p className={`mt-3 text-[12px] leading-relaxed ${muted}`}>
            Videos, illustrations and notes remain © {partner.name}. ICU 360 embeds his YouTube videos and links to his pages; nothing is copied, and his material is not sent to the ICU 360 AI tutor.
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-2.5 px-1">
            <h2 className="display text-[20px] font-semibold">Where his videos appear</h2>
            <Chip className="text-brand-700 dark:text-glow-teal">{uniqueVideos} videos</Chip>
          </div>
          <div className="space-y-3">
            {byModule.map(({ m, items }) => (
              <section key={m.id} className="glass rounded-[22px] p-4">
                <Link href={`/m/${m.id}`} className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-ink-400 dark:text-night-faint">{m.title}</Link>
                <ul className="mt-2 space-y-2.5">
                  {items.map((v) => (
                    <li key={`${v.icuTopicId}-${v.youtubeId}`} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <Link href={`/m/${m.id}/${v.icuTopicId}#visual`} className="font-semibold text-[14px] leading-snug inline-flex items-center gap-1">
                          {v.icuTopicTitle}<ChevronRight className="w-3.5 h-3.5 text-ink-400" aria-hidden="true" />
                        </Link>
                        <p className={`text-[12.5px] leading-snug ${muted}`}>
                          <a href={v.armandoUrl} target="_blank" rel="noopener" className="underline decoration-ink-300 dark:decoration-night-faint underline-offset-2">{v.videoTitle}</a>
                        </p>
                      </div>
                      {v.matchStrength === "partial" ? <Chip className="text-ink-500 dark:text-night-muted">Background</Chip> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </Main>
    </>
  );
}
