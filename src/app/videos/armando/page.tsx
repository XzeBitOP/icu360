import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, ChevronRight, Info, Search } from "lucide-react";
import { pageMeta } from "@/lib/seo";
import { PageHeader, Main } from "@/components/Shell";
import { Chip, CircleLink, IconTile, muted, gradBtn } from "@/components/ui";
import { ArmandoCredit } from "@/components/VisualExplanation";
import { LiteYouTube } from "@/components/client/LiteYouTube";
import { getModules } from "@/lib/content";
import { ARMANDO_RESOURCE_LABEL, ARMANDO_RESOURCE_PATH, armandoResourceGroups, getArmando, videoAnchor, ytEmbed, ytThumb } from "@/lib/embedded-videos";

export const metadata: Metadata = pageMeta({
  title: `${ARMANDO_RESOURCE_LABEL}: embedded videos by Armando Hasudungan`,
  description:
    "All Armando Hasudungan videos embedded on ICU 360, grouped by ICU module, each linked to its ICU 360 topic. We do not own these videos; all rights belong to Armando Hasudungan. armandoh.org has complete free-to-use videos, diagrams and PDFs.",
  path: ARMANDO_RESOURCE_PATH,
});

const modAnchor = (id: string) => `mod-${id}`;

export default function ArmandoVideosPage() {
  const { creator } = getArmando();
  const modules = getModules();
  const byId = new Map(modules.map((m) => [m.id, m]));
  const groups = armandoResourceGroups(modules.map((m) => m.id));
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader
        backHref="/browse"
        eyebrow={`Embedded videos · ${total} videos`}
        title={ARMANDO_RESOURCE_LABEL}
        right={<CircleLink href="/search" label="Search"><Search className="w-[19px] h-[19px]" strokeWidth={2} aria-hidden="true" /></CircleLink>}
      />
      <Main className="space-y-6">
        <section className="glass rounded-[26px] p-4 lg:p-5 max-w-[760px]" data-testid="armando-resource-intro">
          <div className="flex items-start gap-3.5">
            <IconTile name="clapperboard" size="w-12 h-12" isz="w-6 h-6" />
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-brand-600 dark:text-glow-teal">Embedded YouTube videos</p>
              <h2 className="display text-[20px] font-semibold leading-snug">{creator.name}</h2>
              <p className="text-[14.5px] leading-[1.55] mt-1 font-medium text-ink-900 dark:text-night-text" data-testid="armando-resource-rights">
                ICU 360 embeds {creator.name}&apos;s YouTube videos. We do not own these videos; all rights belong to {creator.name}.
              </p>
              <p className={`text-[14px] leading-[1.55] mt-2 ${muted}`} data-testid="armando-resource-free">
                His website{" "}
                <a href={creator.site} target="_blank" rel="noopener" className="font-semibold text-brand-600 dark:text-glow-teal">armandoh.org</a>{" "}
                has complete free-to-use videos, diagrams and PDFs.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href={creator.site} target="_blank" rel="noopener" className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-white font-semibold text-[14px]" style={gradBtn}>
              Visit armandoh.org<ExternalLink className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </a>
            <a href={creator.youtube} target="_blank" rel="noopener" className="glass-btn inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[14px] text-ink-900 dark:text-night-text">
              YouTube channel<ExternalLink className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </a>
          </div>
          <p className={`mt-4 flex items-start gap-2 text-[12px] leading-relaxed ${muted}`}>
            <Info className="w-4 h-4 shrink-0 mt-px" strokeWidth={2} aria-hidden="true" />
            <span>
              Videos play from YouTube and load only when you tap play. Each video links to the ICU 360 topic it explains. His videos are not sent to the ICU 360 AI tutor.{" "}
              <Link href="/credits" className="font-semibold text-brand-600 dark:text-glow-teal">Video credits</Link>
            </span>
          </p>
        </section>

        <nav aria-label="Jump to module" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0" data-testid="armando-module-chips">
          {groups.map((g) => (
            <a key={g.moduleId} href={`#${modAnchor(g.moduleId)}`} className="glass-chip shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink-700 dark:text-night-text">
              {byId.get(g.moduleId)?.title} <span className={muted}>{g.items.length}</span>
            </a>
          ))}
        </nav>

        {groups.map((g) => {
          const m = byId.get(g.moduleId)!;
          return (
            <section key={g.moduleId} id={modAnchor(g.moduleId)} className="scroll-mt-24" data-testid="armando-module-group" aria-labelledby={`${modAnchor(g.moduleId)}-h`}>
              <div className="flex items-baseline justify-between gap-3 mb-2.5 px-1">
                <div className="min-w-0">
                  <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-ink-400 dark:text-night-faint">Module {m.number} · {m.section.title}</p>
                  <h2 id={`${modAnchor(g.moduleId)}-h`} className="display text-[20px] font-semibold leading-snug break-words">
                    <Link href={`/m/${m.id}`}>{m.title}</Link>
                  </h2>
                </div>
                <Chip className="text-brand-700 dark:text-glow-teal">{g.items.length === 1 ? "1 video" : `${g.items.length} videos`}</Chip>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {g.items.map((v) => (
                  <article key={v.youtubeId} id={videoAnchor(v.youtubeId)} className="glass rounded-[24px] p-3 lg:p-3.5 space-y-2.5 scroll-mt-24 min-w-0" data-testid="armando-video" data-video-id={v.youtubeId}>
                    <LiteYouTube id={v.youtubeId} title={v.videoTitle} thumb={ytThumb(v.youtubeId)} embed={ytEmbed(v.youtubeId)} />
                    <div className="px-0.5 space-y-1.5">
                      <h3 className="font-semibold text-[15px] leading-snug break-words" data-testid="armando-video-title">{v.videoTitle}</h3>
                      <p className={`text-[13px] leading-[1.45] ${muted}`}>{v.blurb}</p>
                      <ul className="space-y-1" aria-label="ICU 360 topics">
                        {v.topics.map((t) => (
                          <li key={`${t.moduleId}/${t.topicId}`} className="flex items-start gap-2">
                            <Link href={`/m/${t.moduleId}/${t.topicId}#visual`} className="flex-1 min-w-0 inline-flex items-start gap-1 text-[13px] font-semibold leading-snug text-brand-600 dark:text-glow-teal" data-testid="armando-video-topic">
                              <span className="break-words">ICU 360 topic: {t.title}{t.moduleId !== g.moduleId ? ` · ${byId.get(t.moduleId)?.title}` : ""}</span>
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-[3px]" aria-hidden="true" />
                            </Link>
                            {!t.strong ? <Chip className="text-ink-500 dark:text-night-muted">Background</Chip> : null}
                          </li>
                        ))}
                      </ul>
                      <ArmandoCredit v={v.primary} />
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <a href={v.armandoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal">
                          Watch on armandoh.org<ExternalLink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                        </a>
                        {v.notesUrl ? (
                          <a href={v.notesUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal">
                            His notes on this topic<ExternalLink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <p className={`max-w-[760px] px-1 text-[11.5px] leading-relaxed ${muted}`} data-testid="armando-resource-footnote">
          Embedded videos by Armando Hasudungan. ICU 360 does not own these videos; all rights belong to Armando Hasudungan. Free videos, diagrams and PDFs at{" "}
          <a href="https://armandoh.org" target="_blank" rel="noopener" className="font-semibold text-brand-600 dark:text-glow-teal">armandoh.org</a>.
        </p>
      </Main>
    </>
  );
}
