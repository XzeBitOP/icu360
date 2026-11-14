import { NextResponse } from "next/server";
import { isoWeek } from "@/lib/format";
import { pipeline, redisConfigured, zsetToRecord } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

const floorK = (n: number) => Math.floor(n / 1000) * 1000;

/**
 * GET → the PUBLIC, rounded-down view counts and last week's top topic, in the same shape as
 * content/views.json. Read by the weekly GitHub Action (VIEWS_SOURCE_URL), so GitHub never needs the
 * Redis credentials. Exact counts stay private (they are only on /stats behind STATS_PASSWORD).
 */
export async function GET() {
  if (!redisConfigured()) return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  const week = isoWeek(new Date(Date.now() - 7 * 864e5)); // the week that just ended
  let res;
  try {
    res = await pipeline([
      ["ZRANGE", "views:all", 0, -1, "REV", "WITHSCORES"],
      ["ZRANGE", `views:week:${week}`, 0, -1, "REV", "WITHSCORES"],
    ]);
  } catch {
    return NextResponse.json({ error: "Redis unavailable" }, { status: 502 });
  }
  const [allRes, weekRes] = res ?? [];
  if (!allRes || allRes.error) return NextResponse.json({ error: "Redis error" }, { status: 502 });
  const modules: Record<string, number> = {};
  const topics: Record<string, number> = {};
  const tools: Record<string, number> = {};
  for (const [key, n] of Object.entries(zsetToRecord(allRes.result))) {
    const v = floorK(n);
    if (!v) continue;
    const i = key.indexOf(":");
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    if (kind === "module") modules[id] = v;
    else if (kind === "topic") topics[id] = v;
    else if (kind === "tool") tools[id] = v;
  }
  const topKey = Object.entries(zsetToRecord(weekRes?.result)).find(([k, n]) => k.startsWith("topic:") && n > 0)?.[0];
  let topTopic: { moduleId: string; topicId: string; week: string } | null = null;
  if (topKey) {
    const [moduleId, topicId] = topKey.slice(6).split("/");
    if (moduleId && topicId) topTopic = { moduleId, topicId, week };
  }
  return NextResponse.json({ configured: true, week, modules, topics, tools, topTopic }, { headers: { "Cache-Control": "no-store" } });
}
