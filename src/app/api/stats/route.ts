import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { isoWeek } from "@/lib/format";
import { pipeline, redisConfigured, zsetToRecord } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

function same(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** POST { password } → raw view counts (all time, this week, last week). Protected by STATS_PASSWORD. */
export async function POST(req: Request) {
  const pw = process.env.STATS_PASSWORD;
  if (!pw) return NextResponse.json({ error: "STATS_PASSWORD is not set on the server." }, { status: 503 });
  let given = "";
  try {
    given = String(((await req.json()) as { password?: unknown }).password ?? "");
  } catch {}
  if (!same(given, pw)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  if (!redisConfigured()) return NextResponse.json({ error: "Upstash Redis is not configured, so no views are being counted yet." }, { status: 503 });
  const now = new Date();
  const thisWeek = isoWeek(now);
  const lastWeek = isoWeek(new Date(now.getTime() - 7 * 864e5));
  try {
    const r = await pipeline([
      ["ZRANGE", "views:all", 0, -1, "REV", "WITHSCORES"],
      ["ZRANGE", `views:week:${thisWeek}`, 0, -1, "REV", "WITHSCORES"],
      ["ZRANGE", `views:week:${lastWeek}`, 0, -1, "REV", "WITHSCORES"],
    ]);
    return NextResponse.json(
      { generatedAt: now.toISOString(), thisWeek, lastWeek, all: zsetToRecord(r?.[0]?.result), week: zsetToRecord(r?.[1]?.result), prevWeek: zsetToRecord(r?.[2]?.result) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not reach Upstash." }, { status: 502 });
  }
}
