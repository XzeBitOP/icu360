import { NextResponse } from "next/server";
import viewKeys from "@/generated/view-keys.json";
import { isoWeek } from "@/lib/format";
import { pipeline, redisConfigured } from "@/lib/server/redis";

const VALID = new Set<string>(viewKeys as string[]);
const WEEK_TTL = 60 * 60 * 24 * 90;

/** POST { keys: ["topic:<module>/<topic>", "module:<id>", "tool:<id>"] } → increments all-time and this ISO week's counters. */
export async function POST(req: Request) {
  if (!redisConfigured()) return new NextResponse(null, { status: 204 });
  let keys: string[] = [];
  try {
    const body = (await req.json()) as { keys?: unknown };
    if (Array.isArray(body.keys)) keys = body.keys.filter((k): k is string => typeof k === "string" && VALID.has(k));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  keys = [...new Set(keys)].slice(0, 4);
  if (!keys.length) return NextResponse.json({ ok: false }, { status: 400 });
  const week = `views:week:${isoWeek()}`;
  const cmds: (string | number)[][] = [];
  for (const k of keys) {
    cmds.push(["ZINCRBY", "views:all", 1, k]);
    cmds.push(["ZINCRBY", week, 1, k]);
  }
  cmds.push(["EXPIRE", week, WEEK_TTL]);
  try {
    await pipeline(cmds);
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  return new NextResponse(null, { status: 204 });
}
