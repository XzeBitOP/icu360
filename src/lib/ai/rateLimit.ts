import { pipeline, redisConfigured } from "@/lib/server/redis";

/**
 * Per-IP daily limit for /api/ai.
 * - With Upstash Redis configured (UPSTASH_REDIS_REST_* or KV_REST_API_*), the count is shared across all serverless instances.
 * - Without it, an in-memory Map is used. That count is per instance and resets on cold start, so it is a soft limit only.
 * The day is the IST calendar day.
 */
export const DEFAULT_DAILY_LIMIT = 20;

export function dailyLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

export function istDay(now: number): string {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export type RateResult = { allowed: boolean; remaining: number; limit: number };

const mem = new Map<string, number>();
let memDay = "";

export function memoryHit(key: string, limit: number, now = Date.now()): RateResult {
  const day = istDay(now);
  if (day !== memDay) { mem.clear(); memDay = day; }
  const used = (mem.get(key) ?? 0) + 1;
  mem.set(key, used);
  return { allowed: used <= limit, remaining: Math.max(0, limit - used), limit };
}

export function resetMemoryLimiter() { mem.clear(); memDay = ""; }

export async function hitRateLimit(ip: string, opts: { limit?: number; now?: number } = {}): Promise<RateResult> {
  const limit = opts.limit ?? dailyLimit();
  const now = opts.now ?? Date.now();
  const key = `ai:${istDay(now)}:${ip}`;
  if (redisConfigured()) {
    try {
      const res = await pipeline([["INCR", key], ["EXPIRE", key, 60 * 60 * 26]]);
      const used = Number(res?.[0]?.result);
      if (Number.isFinite(used)) return { allowed: used <= limit, remaining: Math.max(0, limit - used), limit };
    } catch {
      /* fall back to memory */
    }
  }
  return memoryHit(key, limit, now);
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}
