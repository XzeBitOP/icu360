"use client";
import { motion } from "framer-motion";

export function Ring({ pct, size = 120, stroke = 10, label, sub }: { pct: number; size?: number; stroke?: number; label?: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const id = `rg-${size}-${stroke}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14B8A6" />
            <stop offset=".55" stopColor="#2563EB" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-200/80 dark:stroke-white/10" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={`url(#${id})`} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p / 100) }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          {label ? <p className="font-mono font-semibold tnum leading-none" style={{ fontSize: size * 0.22 }}>{label}</p> : null}
          {sub ? <p className="text-[11px] text-ink-500 dark:text-night-muted mt-1">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}
