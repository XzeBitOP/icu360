"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { House, LayoutGrid, Calculator, Star, Newspaper, ChevronLeft } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", Icon: House, match: (p: string) => p === "/" },
  { href: "/browse", label: "Browse", Icon: LayoutGrid, match: (p: string) => p.startsWith("/browse") || p.startsWith("/section") || p.startsWith("/m/") || p.startsWith("/search") },
  { href: "/tools", label: "Tools", Icon: Calculator, match: (p: string) => p.startsWith("/tools") },
  { href: "/saved", label: "Saved", Icon: Star, match: (p: string) => p.startsWith("/saved") || p.startsWith("/progress") },
  { href: "/news", label: "News", Icon: Newspaper, match: (p: string) => p.startsWith("/news") || p.startsWith("/quiz") },
];

const IDLE_MS = 4000;
const INTERACTION_EVENTS = ["scroll", "wheel", "touchstart", "touchmove", "pointerdown", "pointermove", "keydown", "focusin"] as const;

/** True while the user is typing or a modal is open: the tab bar must never hide then. */
function shouldStayVisible(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return true;
    if (el.closest("[data-tabbar]")) return true;
  }
  return !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [aria-modal="true"]');
}

/** Hides the bar after IDLE_MS without any interaction; shows it again immediately on any interaction. */
function useIdleHide(resetKey: string) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const set = (v: boolean) => {
      if (hiddenRef.current !== v) { hiddenRef.current = v; setHidden(v); }
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (shouldStayVisible()) arm();
        else set(true);
      }, IDLE_MS);
    };
    const onActivity = () => { set(false); arm(); };
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    INTERACTION_EVENTS.forEach((e) => window.addEventListener(e, onActivity, opts));
    const onVis = () => { if (document.visibilityState === "visible") onActivity(); };
    document.addEventListener("visibilitychange", onVis);
    onActivity();
    return () => {
      clearTimeout(timer);
      INTERACTION_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, opts));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [resetKey]);
  return hidden;
}

export function TabBar() {
  const p = usePathname() || "/";
  const hidden = useIdleHide(p);
  return (
    <nav aria-label="Main" data-tabbar="" data-hidden={hidden ? "true" : "false"} className="tabbar lg:hidden fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] inset-x-3 z-30 glass blur-glass rounded-[30px] px-1.5 py-1.5 max-w-[560px] mx-auto">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const on = match(p);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-[24px] text-[10.5px] font-semibold ${on ? "tab-active text-brand-700 dark:text-glow-teal" : "text-ink-500 dark:text-night-muted"}`}>
                <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.1 : 1.75} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const p = usePathname() || "/";
  return (
    <nav className="px-3 space-y-1" aria-label="Main">
      {ITEMS.map(({ href, label, Icon, match }) => {
        const on = match(p);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 px-3 h-10 rounded-[14px] text-[14px] font-semibold ${on ? "tab-active text-brand-700 dark:text-glow-teal" : "text-ink-700 dark:text-night-text hover:bg-white/30 dark:hover:bg-white/5"}`}>
            <Icon className="w-[18px] h-[18px]" strokeWidth={on ? 2.1 : 1.8} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SideSectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  const p = usePathname() || "/";
  const on = p === href;
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-3 h-[34px] rounded-[12px] text-[12.5px] ${on ? "tab-active text-brand-700 dark:text-glow-teal font-semibold" : "text-ink-700 dark:text-night-text hover:bg-white/30 dark:hover:bg-white/5"}`}>
      {children}
    </Link>
  );
}

export function BackButton({ fallback = "/", className = "" }: { fallback?: string; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" aria-label="Back"
      onClick={() => { if (window.history.length > 1) router.back(); else router.push(fallback); }}
      className={`glass-btn blur-glass w-10 h-10 grid place-items-center rounded-full text-ink-700 dark:text-night-text ${className}`}>
      <ChevronLeft className="w-[19px] h-[19px]" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
