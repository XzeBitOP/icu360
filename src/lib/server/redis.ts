/** Minimal Upstash Redis REST client (no SDK). Returns null when env vars are missing so the app works without it. */

/**
 * Connection details. Accepts either naming:
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Upstash console), preferred
 * - KV_REST_API_URL / KV_REST_API_TOKEN (added by the Vercel Marketplace "Upstash for Redis" integration)
 */
export function redisEnv(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function redisConfigured() {
  return redisEnv() !== null;
}

export async function pipeline(commands: (string | number)[][]): Promise<{ result?: unknown; error?: string }[] | null> {
  const cfg = redisEnv();
  if (!cfg || !commands.length) return null;
  const { url, token } = cfg;
  const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

/** ZRANGE ... WITHSCORES REV → { member: score } */
export function zsetToRecord(flat: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = Number(flat[i + 1]);
  return out;
}
