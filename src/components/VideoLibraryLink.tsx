import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconTile, muted } from "./ui";
import { VIDEO_LIBRARY_LABEL, VIDEO_LIBRARY_PATH, freeVideoChannels, getFreeVideos } from "@/lib/embedded-videos";

/** "Video library" entry card (same glass card as the "Video resource by Armandoh" entry). */
export function VideoLibraryLink({ className = "" }: { className?: string }) {
  const n = getFreeVideos().videos.length;
  const c = freeVideoChannels().length;
  return (
    <Link href={VIDEO_LIBRARY_PATH} className={`glass rounded-[24px] p-4 flex items-center gap-3.5 ${className}`} data-testid="video-library-link">
      <IconTile name="clapperboard" size="w-12 h-12" isz="w-6 h-6" />
      <div className="flex-1 min-w-0">
        <p className="display font-semibold text-[17px] leading-snug">{VIDEO_LIBRARY_LABEL}</p>
        <p className={`text-[12.5px] ${muted} leading-snug`}>{n} free YouTube videos from {c} channels, by module</p>
      </div>
      <ChevronRight className="w-5 h-5 text-ink-400 shrink-0" aria-hidden="true" />
    </Link>
  );
}
