"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Registers the service worker and flags low-end devices so heavy glass blur is switched off. */
export function PwaSetup() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 3;
    const fewCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4 && /Android/i.test(nav.userAgent);
    if (lowMem || fewCores) document.documentElement.classList.add("lowfx");

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
  }, []);
  return null;
}
