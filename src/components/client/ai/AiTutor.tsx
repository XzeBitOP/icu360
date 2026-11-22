"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send, ShieldAlert, RotateCcw } from "lucide-react";
import { AiMascot } from "../AiMascot";
import { useEffect } from "react";
import { create } from "zustand";
import { Block } from "@/components/Markdown";
import { ACTION_LABELS, AI_LIMITS, defaultActions, type AiAction, type AiContext } from "@/lib/ai/schema";

const muted = "text-ink-500 dark:text-night-muted";
const grad = { background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3),0 10px 24px -10px rgba(27,79,160,.7)" };
export const AI_DISCLAIMER = "AI explanation for learning only. Not for bedside decisions. Verify with the references.";

type Status = "idle" | "loading" | "streaming" | "done" | "error";
type State = {
  open: boolean;
  ctx: AiContext | null;
  action: AiAction | null;
  question: string;
  answer: string;
  status: Status;
  remaining: number | null;
  ms: number | null;
  draft: string;
  setDraft: (s: string) => void;
  show: (ctx: AiContext, action?: AiAction) => void;
  close: () => void;
  run: (action: AiAction, question?: string) => Promise<void>;
};

let inflight: AbortController | null = null;

/** One AI panel for the whole site. Buttons anywhere call `show(context)`; the panel is mounted once in the root layout. */
export const useAiTutor = create<State>((set, get) => ({
  open: false, ctx: null, action: null, question: "", answer: "", status: "idle", remaining: null, ms: null, draft: "",
  setDraft: (draft) => set({ draft }),
  show: (ctx, action) => {
    inflight?.abort();
    set({ open: true, ctx, action: null, question: "", answer: "", status: "idle", ms: null, draft: "" });
    const first = action ?? ctx.actions?.[0] ?? defaultActions(ctx.kind)[0];
    void get().run(first);
  },
  close: () => { inflight?.abort(); set({ open: false }); },
  run: async (action, question) => {
    const ctx = get().ctx;
    if (!ctx) return;
    inflight?.abort();
    const ac = new AbortController();
    inflight = ac;
    const t0 = performance.now();
    set({ action, question: question ?? "", answer: "", status: "loading", ms: null });
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind: ctx.kind, title: ctx.title, context: ctx.text, ...(action === "followup" ? { question } : {}) }),
        signal: ac.signal,
      });
      const rem = res.headers.get("X-RateLimit-Remaining");
      if (rem !== null) set({ remaining: Number(rem) });
      if (!res.ok || !res.body) {
        let msg = "The AI tutor couldn't answer just now. Please try again shortly.";
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
        set({ status: "error", answer: msg });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        if (inflight !== ac) return;
        set({ answer: text, status: "streaming" });
      }
      set({ answer: text.trim() || "The AI tutor couldn't answer just now. Please try again shortly.", status: "done", ms: Math.round(performance.now() - t0) });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      set({ status: "error", answer: "You seem to be offline. The AI tutor needs an internet connection." });
    }
  },
}));

/** Small "Ask AI" pill. Pass the block's own context, or `getContext` for live state (simulators, calculators) read at click time. */
export function AiButton({ context, getContext, action, label = "Ask AI", variant = "chip", className = "", testId }: {
  context?: AiContext; getContext?: () => AiContext | null; action?: AiAction; label?: string; variant?: "chip" | "sim"; className?: string; testId?: string;
}) {
  const onClick = () => {
    const c = getContext ? getContext() : context;
    if (c) useAiTutor.getState().show(c, action);
  };
  const mascotLabel = /\bAI\b/.test(label) ? null : "Ask AI";
  if (variant === "sim")
    return <button type="button" className={`btn ${className}`} onClick={onClick} data-testid={testId ?? "ai-button"} aria-haspopup="dialog"><AiMascot size={15} label={mascotLabel} className="inline-block align-[-3px] mr-1" />{label}</button>;
  return (
    <button type="button" onClick={onClick} data-testid={testId ?? "ai-button"} aria-haspopup="dialog"
      className={`glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 dark:text-glow-teal shrink-0 ${className}`}>
      <AiMascot size={16} label={mascotLabel} />{label}
    </button>
  );
}

export function AiSheet() {
  const { open, ctx, action, question, answer, status, remaining, close, run, draft: q, setDraft: setQ } = useAiTutor();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close]);
  const actions = ctx ? (ctx.actions ?? defaultActions(ctx.kind)) : [];
  const busy = status === "loading" || status === "streaming";
  const send = () => { const t = q.trim(); if (!t || busy) return; void run("followup", t); setQ(""); };

  return (
    <AnimatePresence>
      {open && ctx && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} role="dialog" aria-modal="true" aria-label="AI tutor" data-testid="ai-sheet">
          <motion.div className="glass-strong w-full sm:max-w-[560px] rounded-t-[28px] sm:rounded-[28px] flex flex-col max-h-[88vh]" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 px-5 pt-5">
              <AiMascot size={40} active={busy} label="Ask AI" />
              <div className="min-w-0 flex-1">
                <p className={`text-[11.5px] uppercase tracking-[.1em] font-semibold ${muted}`}>AI tutor</p>
                <p className="display font-semibold text-[16.5px] leading-snug line-clamp-2">{ctx.title}</p>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="glass-btn w-9 h-9 grid place-items-center rounded-full shrink-0"><X className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" /></button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 pt-3 pb-1" role="group" aria-label="What should the tutor do?">
              {actions.map((a) => (
                <button key={a} type="button" disabled={busy} onClick={() => void run(a)} aria-pressed={action === a}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-60 ${action === a ? "tab-active text-brand-700 dark:text-glow-teal" : "glass-chip text-ink-700 dark:text-night-text"}`}>{ACTION_LABELS[a]}</button>
              ))}
            </div>
            <div className="overflow-y-auto px-5 pt-2 min-h-[120px]">
              {action === "followup" && question ? <p className={`text-[13px] ${muted} mb-2`}><b className="text-ink-900 dark:text-night-text">You asked:</b> {question}</p> : null}
              <div className={`${status === "error" ? "callout warn pl-5" : "glass"} rounded-[20px] p-4`} aria-live="polite" aria-busy={busy} data-testid="ai-answer" data-status={status}>
                {status === "error" ? <span className="bar bg-warn-bright" /> : null}
                {status === "loading" ? (
                  <div className="space-y-2 animate-pulse" aria-label="Thinking">
                    <div className="h-3 rounded-full bg-ink-300/60 dark:bg-white/10 w-11/12" /><div className="h-3 rounded-full bg-ink-300/60 dark:bg-white/10 w-9/12" /><div className="h-3 rounded-full bg-ink-300/60 dark:bg-white/10 w-10/12" />
                    <p className={`text-[12.5px] ${muted} pt-1 flex items-center gap-1.5`}><AiMascot size={16} active label={null} />Reading only this section…</p>
                  </div>
                ) : (
                  <Block text={answer} className="text-[14px] leading-[1.55]" />
                )}
                {status === "error" ? <button type="button" onClick={() => action && void run(action, question || undefined)} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal"><RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />Try again</button> : null}
              </div>
              <p className={`text-[11.5px] leading-snug ${muted} mt-2 px-1`} data-testid="ai-disclaimer">{AI_DISCLAIMER}</p>
            </div>
            <form className="px-5 pt-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="ai-q">Ask a short follow-up question</label>
                <input id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={AI_LIMITS.question} placeholder="Ask a follow-up about this section" autoComplete="off"
                  className="glass flex-1 min-w-0 h-11 rounded-full px-4 text-[14px] bg-transparent outline-none placeholder:text-ink-400 dark:placeholder:text-night-faint" data-testid="ai-followup" />
                <button type="submit" disabled={!q.trim() || busy} aria-label="Send" className="w-11 h-11 rounded-full grid place-items-center text-white shrink-0 disabled:opacity-40" style={grad}><Send className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" /></button>
              </div>
              <p className={`mt-1.5 text-[11.5px] ${muted} flex items-center gap-1 px-1`}><ShieldAlert className="w-3.5 h-3.5 shrink-0 text-warn dark:text-warn-bright" aria-hidden="true" />Don&apos;t type patient names, IDs or other identifiers.{remaining !== null ? <span className="ml-auto whitespace-nowrap">{remaining} left today</span> : null}</p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
