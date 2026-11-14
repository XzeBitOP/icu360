"use client";
import { Star } from "lucide-react";
import { toggleSaved, useStore, type SavedItem } from "@/lib/store";

export function SavedButton({ item, variant = "circle" }: { item: SavedItem; variant?: "circle" | "inline" }) {
  const s = useStore();
  const on = s.saved.some((x) => x.href === item.href);
  const label = on ? `Remove ${item.title} from saved` : `Save ${item.title}`;
  if (variant === "inline")
    return (
      <button type="button" aria-label={label} aria-pressed={on} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaved(item); }} className="p-1 -m-1">
        <Star className={`w-[19px] h-[19px] ${on ? "text-warn-bright fill-current" : "text-ink-300 dark:text-night-faint"}`} strokeWidth={2} aria-hidden="true" />
      </button>
    );
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={() => toggleSaved(item)}
      className="glass-btn blur-glass w-10 h-10 grid place-items-center rounded-full text-warn dark:text-warn-bright">
      <Star className={`w-[19px] h-[19px] ${on ? "fill-current text-warn-bright" : ""}`} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
