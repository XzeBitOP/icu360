/** Minimal Upstash Redis REST client (no SDK). Returns null when env vars are missing so the app works without it. */

export function redisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function pipeline(commands: (string | number)[][]): Promise<{ result?: unknown; error?: string }[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !commands.length) return null;
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
