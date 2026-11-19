import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, Views, muted } from "@/components/ui";
import { CodeTimer } from "@/components/client/CodeTimer";
import { ViewTracker } from "@/components/client/Tracking";
import { getViews } from "@/lib/content";

export const metadata: Metadata = pageMeta({
  title: "Code timer",
  description: "Cardiac arrest timer: 2-minute CPR cycles, adrenaline and shock log, 4 Hs and 4 Ts.",
  path: "/tools/code-timer",
});

export default function CodeTimerPage() {
  return (
    <>
      <ViewTracker keys={["tool:code-timer"]} />
      <PageHeader backHref="/tools" eyebrow="Cardiac arrest" title="Code timer" meta={<div className="mt-3"><Views n={getViews().tools["code-timer"]} /></div>} />
      <Main className="space-y-5 max-w-[640px]">
        <CodeTimer />
        <Callout kind="info" title="ALS reminders">
          2-minute cycles of high-quality CPR. Shockable rhythm: adrenaline 1 mg and amiodarone 300 mg after the 3rd shock, amiodarone 150 mg after the 5th. Non-shockable: adrenaline 1 mg as soon as IV/IO access is available. Then adrenaline every 3–5 minutes (alternate cycles). See <Link href="/m/cardiac-arrest-post-rosc/als-shockable" className="underline">ALS: shockable rhythms</Link>.
        </Callout>
        <p className={`text-[12px] ${muted} px-1`}>Keep the screen on during a code. The timer keeps running if you switch tabs; the log is kept until you close this tab.</p>
      </Main>
    </>
  );
}
