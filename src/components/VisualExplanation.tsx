import Link from "next/link";
import { ExternalLink, Clapperboard } from "lucide-react";
import { Chip, muted } from "./ui";
import { LiteYouTube } from "./client/LiteYouTube";
import { type EmbeddedVideo, getArmando, ytEmbed, ytThumb } from "@/lib/embedded-videos";

/** Credit line shown under every embedded video: his name, his exact topic page and his site. */
export function ArmandoCredit({ v }: { v: EmbeddedVideo }) {
  const site = getArmando().creator.site;
  return (
    <p className={`text-[12.5px] leading-snug ${muted}`} data-testid="armando-credit">
      Embedded video by{" "}
      <a href={v.armandoUrl} target="_blank" rel="noopener" className="font-semibold text-ink-900 dark:text-night-text underline decoration-ink-300 dark:decoration-night-faint underline-offset-2" data-testid="armando-credit-link">
        Armando Hasudungan
      </a>{" "}
      ·{" "}
      <a href={site} target="_blank" rel="noopener" className="font-semibold text-brand-600 dark:text-glow-teal">
        armandoh.org
      </a>
    </p>
  );
}

/** "Visual explanation" glass card: lite YouTube embed(s) of Armando Hasudungan's videos (we do not own them), with clear credit. */
export function VisualExplanation({ videos }: { videos: EmbeddedVideo[] }) {
  if (!videos.length) return null;
  return (
    <section id="visual" className="glass rounded-[26px] p-4 lg:p-5 scroll-mt-24" aria-labelledby="visual-h" data-testid="visual-explanation">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="visual-h" className="display text-[20px] font-semibold flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-brand-600 dark:text-glow-teal" strokeWidth={2} aria-hidden="true" />
          Visual explanation
        </h2>
        <Chip className="text-brand-700 dark:text-glow-teal">{videos.length > 1 ? `${videos.length} videos` : "Video"}</Chip>
      </div>
      <div className="space-y-5">
        {videos.map((v) => (
          <article key={v.youtubeId} className="space-y-2.5">
            <LiteYouTube id={v.youtubeId} title={v.videoTitle} thumb={ytThumb(v.youtubeId)} embed={ytEmbed(v.youtubeId)} />
            <div className="px-0.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 text-[14px] leading-[1.45] font-medium text-ink-900 dark:text-night-text">{v.blurb}</p>
                {v.matchStrength === "partial" ? <Chip className="text-ink-500 dark:text-night-muted">Background</Chip> : null}
              </div>
              <ArmandoCredit v={v} />
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
      <p className={`mt-4 pt-3 border-t border-ink-200/70 dark:border-white/10 text-[11.5px] leading-relaxed ${muted}`}>
        Embedded video by Armando Hasudungan. ICU 360 does not own this video; all rights belong to Armando Hasudungan. Free videos, diagrams and PDFs at{" "}
        <a href="https://armandoh.org" target="_blank" rel="noopener" className="font-semibold text-brand-600 dark:text-glow-teal">armandoh.org</a>. The video loads from YouTube only when you tap play.{" "}
<Link href="/videos/armando" className="font-semibold text-brand-600 dark:text-glow-teal">Video resource by Armandoh</Link> ·{" "}
        <Link href="/credits" className="font-semibold text-brand-600 dark:text-glow-teal">Video credits</Link>
      </p>
    </section>
  );
}
