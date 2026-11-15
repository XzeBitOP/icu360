"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { IDLE, move, progress, shouldGoBack, start, swipeEnabledFor, type SwipeState } from "@/lib/edge-swipe";

const BLOCK = 'input, textarea, select, [contenteditable="true"], canvas, [role="slider"], [data-no-swipe-back], [data-tabbar]';

/** True if the touch starts on something that owns horizontal touches: form controls, sliders, the interactive tools, or a horizontal scroller. */
function blocked(target: EventTarget | null) {
  let el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest(BLOCK)) return true;
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

/** Only in the installed iOS PWA: Safari tabs (and Android) already have a system back gesture, so we never double up. */
function isIosStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (/iP(hone|ad|od)/.test(nav.userAgent) && window.matchMedia("(display-mode: standalone)").matches);
}

export function EdgeSwipeBack() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const cue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!swipeEnabledFor(pathname) || !isIosStandalone()) return;
    let s: SwipeState = IDLE;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const el = cue.current;
      if (!el) return;
      const p = progress(s);
      el.style.opacity = String(p ? 0.35 + p * 0.65 : 0);
      el.style.transform = `translate3d(${-44 + p * 56}px, ${s.active ? s.y0 - 22 : 0}px, 0) scale(${0.8 + p * 0.2})`;
      el.dataset.ready = p >= 1 ? "true" : "false";
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      s = e.touches.length === 1 && t ? start(t.clientX, t.clientY, !blocked(e.target)) : IDLE;
    };
    const onMove = (e: TouchEvent) => {
      if (!s.active) return;
      const t = e.touches[0];
      if (!t) return;
      s = move(s, t.clientX, t.clientY);
      schedule();
    };
    const onEnd = () => {
      const go = shouldGoBack(s);
      s = IDLE;
      schedule();
      if (go) {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }
    };
    const onCancel = () => { s = IDLE; schedule(); };
    const o: AddEventListenerOptions = { passive: true };
    window.addEventListener("touchstart", onStart, o);
    window.addEventListener("touchmove", onMove, o);
    window.addEventListener("touchend", onEnd, o);
    window.addEventListener("touchcancel", onCancel, o);
    return () => {
      window.removeEventListener("touchstart", onStart, o);
      window.removeEventListener("touchmove", onMove, o);
      window.removeEventListener("touchend", onEnd, o);
      window.removeEventListener("touchcancel", onCancel, o);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname, router]);

  return (
    <div ref={cue} aria-hidden="true" className="edge-swipe-cue glass-btn blur-glass w-11 h-11 rounded-full grid place-items-center text-brand-700 dark:text-glow-teal lg:hidden">
      <ChevronLeft className="w-5 h-5" strokeWidth={2.2} />
    </div>
  );
}
