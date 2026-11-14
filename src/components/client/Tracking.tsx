"use client";
import { useEffect } from "react";
import { markOpened } from "@/lib/store";

/** Counts one view per key per browser session. The API silently ignores calls when Redis is not configured. */
export function ViewTracker({ keys }: { keys: string[] }) {
  const joined = keys.join("|");
  useEffect(() => {
    const list = joined.split("|").filter(Boolean);
    const fresh = list.filter((k) => {
      try {
        const sk = `icu360:seen:${k}`;
        if (sessionStorage.getItem(sk)) return false;
        sessionStorage.setItem(sk, "1");
        return true;
      } catch {
        return true;
      }
    });
    if (!fresh.length) return;
    const body = JSON.stringify({ keys: fresh });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/view", new Blob([body], { type: "application/json" }));
      else fetch("/api/view", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {}
  }, [joined]);
  return null;
}

export function TopicOpened({ moduleId, topicId }: { moduleId: string; topicId: string }) {
  useEffect(() => markOpened(moduleId, topicId), [moduleId, topicId]);
  return null;
}
