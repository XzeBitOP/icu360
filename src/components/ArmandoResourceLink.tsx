import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconTile, muted } from "./ui";
import { ARMANDO_RESOURCE_LABEL, ARMANDO_RESOURCE_PATH, armandoResourceItems } from "@/lib/embedded-videos";

/** "Video resource by Armandoh" entry card (same glass card as the Antimicrobials entry on Browse). */
export function ArmandoResourceLink({ className = "" }: { className?: string }) {
  const n = armandoResourceItems().length;
  return (
    <Link href={ARMANDO_RESOURCE_PATH} className={`glass rounded-[24px] p-4 flex items-center gap-3.5 ${className}`} data-testid="armando-resource-link">
      <IconTile name="clapperboard" size="w-12 h-12" isz="w-6 h-6" />
      <div className="flex-1 min-w-0">
        <p className="display font-semibold text-[17px] leading-snug">{ARMANDO_RESOURCE_LABEL}</p>
        <p className={`text-[12.5px] ${muted} leading-snug`}>{n} embedded videos by Armando Hasudungan · armandoh.org</p>
      </div>
      <ChevronRight className="w-5 h-5 text-ink-400 shrink-0" aria-hidden="true" />
    </Link>
  );
}
