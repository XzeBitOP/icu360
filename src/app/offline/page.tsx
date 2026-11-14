import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Main } from "@/components/Shell";
import { QUICK } from "@/lib/site";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <Main className="max-w-[560px] pt-10">
      <div className="glass-strong rounded-[28px] p-6 text-center">
        <span className="mx-auto w-14 h-14 rounded-[18px] grid place-items-center text-white" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)" }}><WifiOff className="w-7 h-7" aria-hidden="true" /></span>
        <h1 className="display font-semibold text-[24px] mt-4">You are offline</h1>
        <p className="text-[14px] text-ink-500 dark:text-night-muted mt-2">This page has not been saved on this device yet. Pages you have opened before still work. To keep everything for the ward, use “Download for offline use” on the Progress page when you are back online.</p>
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {QUICK.map((c) => <Link key={c.href} href={c.href} className="glass-chip rounded-full px-3.5 py-2 text-[13px] font-semibold">{c.label}</Link>)}
        </div>
      </div>
    </Main>
  );
}
