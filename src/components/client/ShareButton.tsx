"use client";
import { Share2, Check } from "lucide-react";
import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-label="Share"
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title: `${title} · ICU 360`, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        } catch {}
      }}
      className="glass-btn blur-glass w-10 h-10 grid place-items-center rounded-full text-ink-700 dark:text-night-text">
      {copied ? <Check className="w-[19px] h-[19px]" strokeWidth={2} aria-hidden="true" /> : <Share2 className="w-[19px] h-[19px]" strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
