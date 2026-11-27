import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Clapperboard, ChevronRight, Info } from "lucide-react";
import { pageMeta } from "@/lib/seo";
import { PageHeader, Main } from "@/components/Shell";
import { Chip, muted, gradBtn } from "@/components/ui";
import { getArmando, freeVideoChannels, getFreeVideos, VIDEO_LIBRARY_LABEL, VIDEO_LIBRARY_PATH } from "@/lib/embedded-videos";
import { getModules } from "@/lib/content";

export const metadata: Metadata = pageMeta({
  title: "Video credits: embedded YouTube videos and their creators",
  description:
    "ICU 360 embeds Armando Hasudungan's YouTube videos and free YouTube videos from other educators. We do not own these videos; all rights belong to their creators. armandoh.org has complete free-to-use videos, diagrams and PDFs.",
  path: "/credits",
});

export default function CreditsPage() {
  const { creator, videos } = getArmando();
  const byModule = getModules()
    .map((m) => ({ m, items: videos.filter((v) => v.icuModuleId === m.id) }))
    .filter((x) => x.items.length);
  const uniqueVideos = new Set(videos.map((v) => v.youtubeId)).size;
  const topics = new Set(videos.map((v) => `${v.icuModuleId}/${v.icuTopicId}`)).size;
  const free = getFreeVideos();
  const freeChannels = freeVideoChannels();
  const freeTopics = new Set(free.videos.map((v) => `${v.icuModuleId}/${v.icuTopicId}`)).size;

  return (
    <>
      <PageHeader eyebrow="Embedded videos" title="Video credits" />
      <Main className="space-y-6 max-w-[760px]">
        <section className="glass rounded-[26px] p-4 lg:p-5" data-testid="credit-armando">
          <div className="flex items-start gap-3.5">
            <span className="w-12 h-12 rounded-[16px] grid place-items-center text-white shrink-0" style={gradBtn} aria-hidden="true">
              <Clapperboard className="w-6 h-6" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-brand-600 dark:text-glow-teal">Embedded YouTube videos</p>
              <h2 className="display text-[22px] font-semibold leading-snug">{creator.name}</h2>
              <p className="text-[14.5px] leading-[1.55] mt-1 font-medium text-ink-900 dark:text-night-text" data-testid="credit-rights">
                ICU 360 embeds {creator.name}&apos;s YouTube videos on {topics} topics. We do not own these videos; all rights belong to {creator.name}.
              </p>
              <p className={`text-[14px] leading-[1.55] mt-2 ${muted}`} data-testid="credit-free">
                His website{" "}
                <a href={creator.site} target="_blank" rel="noopener" className="font-semibold text-brand-600 dark:text-glow-teal">armandoh.org</a>{" "}
                has complete free-to-use videos, diagrams and PDFs.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href={creator.site} target="_blank" rel="noopener" className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-white font-semibold text-[14px]" style={gradBtn} data-testid="credit-site">
              Visit armandoh.org<ExternalLink className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </a>
            <Link href="/videos/armando" className="glass-btn inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[14px] text-ink-900 dark:text-night-text" data-testid="credit-resource">
              Video resource by Armandoh<ChevronRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
            <a href={creator.youtube} target="_blank" rel="noopener" className="glass-btn inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[14px] text-ink-900 dark:text-night-text">
              YouTube channel<ExternalLink className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </a>
          </div>
          <p className={`mt-4 flex items-start gap-2 text-[12px] leading-relaxed ${muted}`}>
            <Info className="w-4 h-4 shrink-0 mt-px" strokeWidth={2} aria-hidden="true" />
            <span>Videos play from YouTube and load only when you tap play. ICU 360 links to his pages and does not copy his notes or diagrams. His videos are not sent to the ICU 360 AI tutor.</span>
          </p>
        </section>

        <section className="glass rounded-[26px] p-4 lg:p-5" data-testid="credit-youtube-channels">
          <div className="flex items-start gap-3.5">
            <span className="w-12 h-12 rounded-[16px] grid place-items-center text-white shrink-0" style={gradBtn} aria-hidden="true">
              <Clapperboard className="w-6 h-6" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-brand-600 dark:text-glow-teal">Embedded YouTube videos</p>
              <h2 className="display text-[22px] font-semibold leading-snug">Free videos from other educators</h2>
              <p className="text-[14.5px] leading-[1.55] mt-1 font-medium text-ink-900 dark:text-night-text" data-testid="credit-youtube-rights">
                ICU 360 embeds {free.videos.length} free YouTube videos from {freeChannels.length} channels on {freeTopics} topics. We do not own these videos; all rights belong to the creators. Each video is credited to its channel where it appears.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={VIDEO_LIBRARY_PATH} className="glass-btn inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[14px] text-ink-900 dark:text-night-text" data-testid="credit-library">
              {VIDEO_LIBRARY_LABEL}<ChevronRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5" aria-label="Credited YouTube channels">
            {freeChannels.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 min-w-0" data-testid="credit-channel">
                <a href={c.youtube} target="_blank" rel="noopener" className="min-w-0 break-words font-semibold text-[14px] leading-snug text-ink-900 dark:text-night-text underline decoration-ink-300 dark:decoration-night-faint underline-offset-2">
                  {c.name}
                </a>
                <span className={`shrink-0 text-[12px] ${muted}`}>{c.count === 1 ? "1 video" : `${c.count} videos`}</span>
              </li>
            ))}
          </ul>
          <p className={`mt-4 flex items-start gap-2 text-[12px] leading-relaxed ${muted}`}>
            <Info className="w-4 h-4 shrink-0 mt-px" strokeWidth={2} aria-hidden="true" />
            <span>Videos play from YouTube and load only when you tap play. They are embedded using each creator&apos;s own YouTube embedding setting and are not sent to the ICU 360 AI tutor. Listing a channel here does not mean it endorses ICU 360.</span>
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3 mb-2.5 px-1">
            <h2 className="display text-[20px] font-semibold">Where his videos are embedded</h2>
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
