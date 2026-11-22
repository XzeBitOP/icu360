import { NextResponse } from "next/server";
import { validateAiRequest } from "@/lib/ai/schema";
import { buildMessages } from "@/lib/ai/prompt";
import { clientIp, hitRateLimit } from "@/lib/ai/rateLimit";
import { AiUpstreamError, FRIENDLY, streamCompletion } from "@/lib/ai/openrouter";

export const maxDuration = 60;

const MAX_BODY = 16_000;

function err(status: number, error: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

/** POST { action, kind, title, context, question? } → streamed plain-text answer from the AI tutor. */
export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) return err(503, FRIENDLY.config);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return err(413, "That section is too long for the AI tutor.");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return err(400, "Invalid request."); }
  const v = validateAiRequest(body);
  if (!v.ok) return err(400, v.error);

  const rl = await hitRateLimit(clientIp(req.headers));
  const rlHeaders = { "X-RateLimit-Limit": String(rl.limit), "X-RateLimit-Remaining": String(rl.remaining) };
  if (!rl.allowed) return err(429, `You've used today's ${rl.limit} free AI answers. They reset at midnight IST.`, rlHeaders);

  try {
    const { stream } = await streamCompletion(buildMessages(v.value), { referer: "https://icu360.in" });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...rlHeaders },
    });
  } catch (e) {
    if (e instanceof AiUpstreamError) return err(e.status, e.userMessage, rlHeaders);
    return err(502, FRIENDLY.down, rlHeaders);
  }
}
