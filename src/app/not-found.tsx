import Link from "next/link";
import { Main } from "@/components/Shell";

export default function NotFound() {
  return (
    <Main className="max-w-[560px] pt-10">
      <div className="glass-strong rounded-[28px] p-6 text-center">
        <p className="font-mono text-[44px] font-semibold text-brand-600 dark:text-glow-teal">404</p>
        <h1 className="display font-semibold text-[22px] mt-1">This page is not on the ward round</h1>
        <p className="text-[14px] text-ink-500 dark:text-night-muted mt-2">It may have moved. Search for the topic or go back home.</p>
        <div className="flex justify-center gap-2 mt-5">
          <Link href="/search" className="glass-chip rounded-full px-4 py-2 text-[13px] font-semibold">Search</Link>
          <Link href="/" className="rounded-full px-4 py-2 text-[13px] font-semibold text-white" style={{ background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)" }}>Home</Link>
        </div>
      </div>
    </Main>
  );
}
