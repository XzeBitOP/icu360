import Link from "next/link";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { getSections } from "@/lib/content";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { SideNav, SideSectionLink, BackButton } from "./client/Nav";
import { ThemeToggle } from "./client/ThemeToggle";

export function Aurora() {
  const pos: [string, string, string][] = [["a1", "-4%", "-30%"], ["a2", "6%", "45%"], ["a3", "22%", "-35%"], ["a4", "36%", "50%"], ["a1", "50%", "-25%"], ["a3", "64%", "45%"], ["a2", "80%", "-30%"], ["a4", "92%", "40%"]];
  return (
    <div className="aurora" aria-hidden="true">
      {pos.map(([c, t, l], i) => (
        <span key={i} className={c} style={{ top: t, left: l }} />
      ))}
    </div>
  );
}

export function Sidebar() {
  const sections = getSections();
  return (
    <aside className="hidden lg:block w-[300px] xl:w-[320px] shrink-0 h-screen sticky top-0 p-4">
      <div className="glass blur-glass h-full rounded-[28px] flex flex-col overflow-hidden">
        <Link href="/" className="px-5 h-[72px] flex items-center gap-3 shrink-0">
          <Logo size={36} />
          <span className="display text-[20px] font-bold">ICU 360</span>
        </Link>
        <SideNav />
        <p className="px-6 mt-5 mb-1.5 text-[11px] uppercase tracking-[.1em] font-semibold text-ink-400 dark:text-night-faint">Sections</p>
        <nav className="px-3 overflow-y-auto no-scrollbar" aria-label="Sections">
          {sections.map((s) => (
            <SideSectionLink key={s.id} href={`/section/${s.slug}`}>
              <Icon name={s.icon} className="w-4 h-4 text-ink-400 dark:text-night-muted" />
              <span className="flex-1 truncate">{s.title}</span>
              <span className="text-[11px] text-ink-500 dark:text-night-muted tnum">{s.modules.length}</span>
            </SideSectionLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-[11.5px] text-ink-500 dark:text-night-muted leading-relaxed">Educational reference for clinicians. Verify doses locally.</div>
      </div>
    </aside>
  );
}

export function TopBar() {
  return (
    <div className="hidden lg:flex h-[76px] items-center gap-4 pr-6 pt-4">
      <Link href="/search" className="glass blur-glass flex items-center gap-3 h-12 w-full max-w-[520px] px-5 rounded-full text-ink-400 dark:text-night-muted">
        <Search className="w-[18px] h-[18px]" strokeWidth={2.1} aria-hidden="true" />
        <span className="text-[14px] flex-1">Search modules, drugs, calculators</span>
        <kbd className="glass-chip font-sans text-[11px] font-semibold rounded-md px-2 py-0.5">Ctrl K</kbd>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </div>
  );
}

/** iOS-style page header: floating glass buttons, then a large title. */
export function PageHeader({ back = true, backHref = "/", eyebrow, title, right, meta }: { back?: boolean; backHref?: string; eyebrow?: ReactNode; title: ReactNode; right?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="px-4 lg:px-1 pt-4 lg:pt-2">
      <div className="flex items-center gap-2 min-h-10">
        {back ? <BackButton fallback={backHref} className="lg:hidden" /> : null}
        <div className="flex-1" />
        {right}
      </div>
      <div className="mt-4 lg:mt-1 px-1">
        {eyebrow ? <p className="text-[12px] uppercase tracking-[.1em] font-semibold text-brand-600 dark:text-glow-teal">{eyebrow}</p> : null}
        <h1 className="display text-[32px] lg:text-[40px] font-bold leading-[1.08] mt-1 break-words">{title}</h1>
        {meta}
      </div>
    </header>
  );
}

/** Standard page body: mobile padding + room for the floating tab bar. */
export function Main({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`px-4 lg:px-1 pt-5 pb-4 ${className}`}>{children}</main>;
}
