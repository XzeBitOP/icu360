"use client";
import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Lite YouTube embed: shows the thumbnail and a glass play button; the youtube-nocookie iframe is created only
 * after a tap (no third-party requests or cookies before that, light on the PWA and on mobile data).
 */
export function LiteYouTube({ id, title, thumb, embed }: { id: string; title: string; thumb: string; embed: string }) {
  const [on, setOn] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-ink-900/90 dark:bg-black/60" data-testid="lite-yt" data-video-id={id}>
      {on ? (
        <iframe
          data-testid="lite-yt-iframe"
          src={embed}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play video: ${title}`} data-testid="lite-yt-play" className="group absolute inset-0 h-full w-full">
          {thumbOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" decoding="async" onError={() => setThumbOk(false)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          ) : null}
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" aria-hidden="true" />
          <span className="glass-btn blur-glass absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full grid place-items-center text-brand-700 dark:text-glow-teal transition-transform group-active:scale-95" aria-hidden="true">
            <Play className="w-7 h-7 translate-x-[2px] fill-current" strokeWidth={2} />
          </span>
          <span className="absolute left-3 right-3 bottom-2.5 text-left text-[12.5px] font-semibold leading-snug text-white line-clamp-2 drop-shadow">{title}</span>
        </button>
      )}
    </div>
  );
}
