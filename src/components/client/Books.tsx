"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { BOOKS } from "@/data/books";

export function Books() {
  const [openId, setOpenId] = useState<string | null>(null);
  const baseId = useId();

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <section className="glass rounded-[26px] p-5" aria-label="Books by Dr. Kenil Shah">
      <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-ink-400 dark:text-night-faint">Books by Dr. Kenil Shah</p>
      <ul className="mt-2">
        {BOOKS.map((book, i) => {
          const open = openId === book.id;
          const panelId = `${baseId}-${book.id}`;
          return (
            <li key={book.id} className={i > 0 ? "border-t border-ink-200/60 dark:border-white/10" : ""}>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 py-3 text-left rounded-[14px]"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : book.id)}
              >
                <span className="text-[18px] leading-none" aria-hidden="true">{book.emoji}</span>
                <span className="flex-1 min-w-0 font-semibold text-[14.5px] leading-snug text-ink-800 dark:text-night-text">{book.title}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-ink-400 dark:text-night-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    id={panelId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2 pb-3.5 pl-[30px]">
                      {book.links.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-chip rounded-full px-3 py-1.5 text-[12.5px] font-semibold inline-flex items-center gap-1.5 text-ink-700 dark:text-night-text hover:text-brand-700 dark:hover:text-glow-teal transition-colors"
                        >
                          {l.label}
                          <ExternalLink className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
