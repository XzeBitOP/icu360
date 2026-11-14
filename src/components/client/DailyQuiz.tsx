"use client";
import { Flame, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { useMounted } from "./useMounted";
import type { DailySet } from "@/lib/content";
import { istDate, prettyDate } from "@/lib/format";
import { currentStreak, useStore } from "@/lib/store";
import { QuizRunner, type QuizQ } from "./QuizRunner";

const muted = "text-ink-500 dark:text-night-muted";

export function DailyQuiz({ sets }: { sets: DailySet[] }) {
  const s = useStore();
  const today = useMounted() ? istDate() : null;
  const available = useMemo(() => (today ? sets.filter((x) => x.date <= today) : []), [sets, today]);
  const [date, setDate] = useState<string | null>(null);
  const current = available.find((x) => x.date === date) ?? available[0];
  const streak = today ? currentStreak(s, today) : 0;
  if (!today) return <div className="glass rounded-[24px] h-40 animate-pulse" />;
  if (!current) return <p className={`glass rounded-[24px] p-5 text-[14px] ${muted}`}>The first daily set is on its way. Check back tomorrow morning.</p>;
  const done = s.daily.history[current.date];
  const isToday = current.date === today;
  const questions: QuizQ[] = current.questions.map((q) => ({
    id: q.id, stem: q.stem, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation,
    source: q.reference ? { label: q.reference.label, href: q.reference.url, external: true } : q.moduleId ? { label: "Read the topic", href: `/m/${q.moduleId}${q.topicId ? `/${q.topicId}` : ""}` } : undefined,
  }));

  return (
    <div className="space-y-5">
      <section className="glass-hero blur-glass rounded-[28px] p-5 flex items-center gap-4">
        <span className="w-14 h-14 rounded-[18px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}><Flame className="w-7 h-7" aria-hidden="true" /></span>
        <div className="flex-1">
          <p className="text-[12px] uppercase tracking-[.12em] font-semibold text-white/70">Streak</p>
          <p className="font-mono font-semibold text-[34px] leading-none tnum mt-0.5">{streak} <span className="text-[15px] font-sans text-white/80">day{streak === 1 ? "" : "s"}</span></p>
          <p className="text-[12.5px] text-white/70 mt-1">Best {s.daily.best} · stored on this device</p>
        </div>
      </section>
      <div className="flex items-center gap-2 px-1">
        <CalendarDays className="w-4 h-4 text-brand-600 dark:text-glow-teal" aria-hidden="true" />
        <p className="font-semibold text-[15px]">{isToday ? "Today" : prettyDate(current.date)}{current.title ? <span className={`font-normal ${muted}`}> · {current.title}</span> : null}</p>
      </div>
      {!isToday ? <p className={`text-[12.5px] ${muted} px-1 -mt-3`}>No new set yet today, so here is the latest one. Past sets do not count towards the streak.</p> : null}
      {done ? <div className="callout ok rounded-[20px] pl-5 pr-4 py-3"><span className="bar bg-ok" /><p className="text-[14px] font-semibold">Done: {done.score}/{done.total}. You can retake it for practice.</p></div> : null}
      <QuizRunner key={current.date} questions={questions} dailyDate={isToday ? current.date : undefined} />
      {available.length > 1 ? (
        <section>
          <h2 className="display text-[16px] font-semibold mb-2 px-1">Past sets</h2>
          <div className="flex flex-wrap gap-2">
            {available.map((x) => (
              <button key={x.date} type="button" onClick={() => setDate(x.date)} className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${x.date === current.date ? "tab-active text-brand-700 dark:text-glow-teal" : "glass-chip"}`}>
                {prettyDate(x.date)}{s.daily.history[x.date] ? ` · ${s.daily.history[x.date].score}/${s.daily.history[x.date].total}` : ""}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
