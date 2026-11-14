"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, ChevronRight, RotateCcw, Trophy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { recordDaily, recordQuiz, PASS_MARK, useStore } from "@/lib/store";

export interface QuizQ { id: string; stem: string; options: string[]; answerIndex: number; explanation: string; source?: { label: string; href: string; external?: boolean } }

const muted = "text-ink-500 dark:text-night-muted";
const grad = { background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3),0 10px 24px -10px rgba(27,79,160,.7)" };
const strip = (s: string) => s.replace(/\*\*|`/g, "");

export function QuizRunner({ questions, moduleId, dailyDate, doneHref, doneLabel }: { questions: QuizQ[]; moduleId?: string; dailyDate?: string; doneHref?: string; doneLabel?: string }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const s = useStore();
  const prevBest = moduleId ? s.quiz[moduleId] : undefined;
  const q = questions[i];

  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.answerIndex) setScore((x) => x + 1);
  };
  const next = () => {
    if (i + 1 >= questions.length) {
      const pct = (score / questions.length) * 100;
      if (moduleId) recordQuiz(moduleId, pct);
      if (dailyDate) recordDaily(dailyDate, score, questions.length);
      setFinished(true);
      return;
    }
    setI(i + 1);
    setPicked(null);
  };
  const restart = () => { setI(0); setPicked(null); setScore(0); setFinished(false); };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const pass = pct >= PASS_MARK;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="glass-hero rounded-[28px] p-6 text-center">
        <Trophy className="w-10 h-10 mx-auto" strokeWidth={1.8} aria-hidden="true" />
        <p className="mt-3 font-mono font-semibold text-[48px] leading-none tnum">{score}/{questions.length}</p>
        <p className="mt-2 text-white/85 text-[15px]">{pct}% · {moduleId ? (pass ? "Pass: quiz complete for this module" : `Pass mark is ${PASS_MARK}%. Review and try again.`) : pass ? "Sharp. See you tomorrow." : "Every miss is a lesson. Read the explanations."}</p>
        {moduleId && prevBest !== undefined ? <p className="text-white/70 text-[13px] mt-1">Previous best {prevBest}%</p> : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={restart} className="h-11 px-5 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5" style={{ background: "rgba(255,255,255,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />Try again
          </button>
          {doneHref ? <Link href={doneHref} className="h-11 px-5 rounded-full bg-white text-ink-900 text-[14px] font-semibold inline-flex items-center gap-1.5">{doneLabel ?? "Done"}<ChevronRight className="w-4 h-4" aria-hidden="true" /></Link> : null}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className={`text-[13px] ${muted}`}>Question <b className="text-ink-900 dark:text-night-text">{i + 1}</b> of {questions.length}</p>
        <p className={`text-[13px] ${muted} tnum`}>Score {score}</p>
      </div>
      <div className="h-1.5 rounded-full bg-ink-300/50 dark:bg-white/10 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#14B8A6,#2563EB,#7C3AED)" }} animate={{ width: `${((i + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="space-y-3">
          <div className="glass-strong rounded-[24px] p-5">
            <p className="display font-semibold text-[18px] leading-snug">{strip(q.stem)}</p>
          </div>
          <ul className="space-y-2.5">
            {q.options.map((o, k) => {
              const state = picked === null ? "idle" : k === q.answerIndex ? "right" : k === picked ? "wrong" : "dim";
              return (
                <li key={k}>
                  <motion.button type="button" whileTap={picked === null ? { scale: 0.98 } : undefined} onClick={() => choose(k)} disabled={picked !== null}
                    className={`w-full text-left rounded-[18px] px-4 py-3.5 flex items-start gap-3 text-[14.5px] leading-snug ${state === "right" ? "callout ok" : state === "wrong" ? "callout crit" : "glass"} ${state === "dim" ? "opacity-55" : ""}`}>
                    <span className={`w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold shrink-0 ${state === "right" ? "bg-ok text-white" : state === "wrong" ? "bg-crit text-white" : "bg-ink-200 text-ink-700 dark:bg-white/10 dark:text-night-text"}`}>
                      {state === "right" ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" /> : state === "wrong" ? <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" /> : String.fromCharCode(65 + k)}
                    </span>
                    <span className="pt-0.5">{strip(o)}</span>
                  </motion.button>
                </li>
              );
            })}
          </ul>
          <AnimatePresence>
            {picked !== null && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`callout ${picked === q.answerIndex ? "ok" : "warn"} rounded-[20px] pl-5 pr-4 py-3.5`}>
                <span className={`bar ${picked === q.answerIndex ? "bg-ok" : "bg-warn-bright"}`} />
                <p className={`text-[12px] font-bold uppercase tracking-[.07em] ${picked === q.answerIndex ? "text-ok dark:text-ok-bright" : "text-warn dark:text-warn-bright"}`}>{picked === q.answerIndex ? "Correct" : "Not quite"}</p>
                <p className="mt-1 text-[14px] leading-[1.5]">{strip(q.explanation)}</p>
                {q.source ? (
                  q.source.external ? (
                    <a href={q.source.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal">{q.source.label}<ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></a>
                  ) : (
                    <Link href={q.source.href} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal">{q.source.label}<ChevronRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>
                  )
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
      <button type="button" onClick={next} disabled={picked === null} className="w-full h-12 rounded-full text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40" style={grad}>
        {i + 1 >= questions.length ? "See score" : "Next question"}<ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
