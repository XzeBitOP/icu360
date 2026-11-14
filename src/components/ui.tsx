import Link from "next/link";
import { Eye, Sparkles, OctagonAlert, TriangleAlert, Lightbulb, Info, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { fmtViews } from "@/lib/format";
import { Icon } from "./Icon";
import { Inline } from "./Markdown";

export const muted = "text-ink-500 dark:text-night-muted";

export function Views({ n, className = "" }: { n?: number; className?: string }) {
  const label = fmtViews(n);
  if (label === "New")
    return (
      <span className={`glass-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-ok dark:text-ok-bright whitespace-nowrap ${className}`} title="Fewer than 1,000 views so far">
        <Sparkles className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
        New
      </span>
    );
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${muted} whitespace-nowrap tnum ${className}`} title={`${label.replace("K", ",000+").replace("M", " million+")} views · rounded down · updated weekly`}>
      <Eye className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
      {label}
      <span className="sr-only"> views</span>
    </span>
  );
}

export function Chip({ children, className = "text-ink-700 dark:text-night-muted" }: { children: ReactNode; className?: string }) {
  return <span className={`glass-chip inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function IconTile({ name, size = "w-10 h-10", isz = "w-5 h-5" }: { name: string; size?: string; isz?: string }) {
  return (
    <span className={`glass-btn ${size} rounded-[14px] grid place-items-center text-brand-700 dark:text-glow-teal shrink-0`}>
      <Icon name={name} className={isz} strokeWidth={1.9} />
    </span>
  );
}

const CALLOUT = {
  crit: { Icon: OctagonAlert, bar: "bg-crit", text: "text-crit dark:text-crit-bright" },
  warn: { Icon: TriangleAlert, bar: "bg-warn-bright", text: "text-warn dark:text-warn-bright" },
  pearl: { Icon: Lightbulb, bar: "bg-pearl", text: "text-pearl dark:text-pearl-bright" },
  info: { Icon: Info, bar: "bg-info", text: "text-info dark:text-info-bright" },
  ok: { Icon: CircleCheck, bar: "bg-ok", text: "text-ok dark:text-ok-bright" },
} as const;

export type CalloutKind = keyof typeof CALLOUT;
export function Callout({ kind, title, children, text }: { kind: CalloutKind; title: string; children?: ReactNode; text?: string }) {
  const k = CALLOUT[kind];
  return (
    <div className={`callout ${kind} rounded-[20px] pl-5 pr-4 py-3.5`}>
      <span className={`bar ${k.bar}`} />
      <div className={`flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.07em] ${k.text}`}>
        <k.Icon className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
        {title}
      </div>
      <div className="mt-1.5 text-[14.5px] leading-[1.5] font-medium text-ink-900 dark:text-night-text">{text ? <Inline text={text} /> : children}</div>
    </div>
  );
}

export function H2({ children, link, href }: { children: ReactNode; link?: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3 px-1">
      <h2 className="display text-[20px] font-semibold">{children}</h2>
      {link && href ? (
        <Link href={href} className="text-[13px] font-semibold text-brand-600 dark:text-glow-teal">
          {link}
        </Link>
      ) : null}
    </div>
  );
}

export function CircleLink({ href, label, children, className = "" }: { href: string; label: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} aria-label={label} className={`glass-btn blur-glass w-10 h-10 grid place-items-center rounded-full text-ink-700 dark:text-night-text ${className}`}>
      {children}
    </Link>
  );
}

export const gradBtn = { background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3),0 10px 24px -10px rgba(27,79,160,.7)" };
export const numBadge = { background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4),0 4px 10px -3px rgba(20,90,140,.55)" };
