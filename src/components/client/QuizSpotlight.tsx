"use client";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { useMounted } from "./useMounted";
import { currentStreak, useStore } from "@/lib/store";
import { istDate } from "@/lib/format";
import { fmtCountdown, msUntilIstMidnight, streakLabel } from "@/lib/quiz-spotlight";

function subscribeSecond(cb: () => void) {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
}
const nowSecond = () => Math.floor(Date.now() / 1000);
const noSecond = () => null;

function Countdown() {
  const sec = useSyncExternalStore(subscribeSecond, nowSecond, noSecond);
  return (
    <span data-testid="quiz-countdown" className="font-mono tnum font-semibold">
      {sec === null ? "--:--:--" : fmtCountdown(msUntilIstMidnight(sec * 1000))}
    </span>
  );
}

/** Highlighted Daily Quiz card at the very top of Home: streak, countdown to the next set, CTA, topic of the week. */
export function QuizSpotlight({ hasQuizToday, topic }: { hasQuizToday: boolean; topic: ReactNode }) {
  const s = useStore();
  const mounted = useMounted();
  const today = mounted ? istDate() : null;
  const streak = today ? currentStreak(s, today) : 0;
  const doneToday = today ? !!s.daily.history[today] : false;
  const sub = doneToday ? "Done today ✓ Come back tomorrow to keep your streak." : hasQuizToday ? "5 new questions are waiting for you." : "Today's set is on its way. Practise with the latest set.";
  return (
    <section data-testid="quiz-spotlight" aria-label="Daily quiz" className="quiz-spotlight glass rounded-[28px] p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] uppercase tracking-[.12em] font-semibold text-warn dark:text-warn-bright">Daily quiz</p>
        <span data-testid="quiz-streak" className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold text-warn dark:text-warn-bright whitespace-nowrap">
          <span className="streak-flame" aria-hidden="true">🔥</span>
          <span className="tnum">{streakLabel(streak)}</span>
        </span>
      </div>
      <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="display font-bold text-[22px] leading-tight">{doneToday ? "Today's quiz done" : "Today's quiz"}</p>
          <p className="text-[13px] text-ink-500 dark:text-night-muted mt-0.5 leading-snug">{sub}</p>
          <p className="text-[12.5px] text-ink-500 dark:text-night-muted mt-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>Next quiz in <Countdown /> <span className="opacity-80">(IST)</span></span>
          </p>
        </div>
        <Link href="/quiz" className="quiz-cta shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full text-[14px] font-semibold text-white">
          {doneToday ? "Retake for practice" : "Start today's quiz"}
          <ChevronRight className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
      <div data-testid="topic-of-week">{topic}</div>
    </section>
  );
}
