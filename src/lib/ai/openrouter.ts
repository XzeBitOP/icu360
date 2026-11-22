import type { ChatMessage } from "./prompt";

/** Server-only OpenRouter client. The API key is read from process.env on the server and never sent to the browser. */
/** Picked after live tests (22 Nov 2026): Ultra followed the algorithm branches faithfully and refused patient-specific questions; ~2 s to first token. */
export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const DEFAULT_FALLBACKS = ["nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "nvidia/nemotron-3.5-super-vl:free"];
export const TIMEOUT_MS = 45_000;

export function modelList(env: Record<string, string | undefined> = process.env): string[] {
  const primary = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = env.OPENROUTER_FALLBACK_MODELS?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_FALLBACKS;
  return [...new Set([primary, ...fallbacks])].slice(0, 3); // OpenRouter accepts up to 3 models in `models`
}

export class AiUpstreamError extends Error {
  constructor(public status: number, public userMessage: string) { super(userMessage); }
}

export const FRIENDLY = {
  busy: "The free AI model is busy right now. Please try again in a minute.",
  down: "The AI tutor couldn't answer just now. Please try again shortly.",
  timeout: "The AI tutor took too long to answer. Please try again.",
  config: "The AI tutor isn't set up yet.",
} as const;

export function requestBody(messages: ChatMessage[], models: string[]) {
  return {
    models,
    messages,
    stream: true,
    max_tokens: 1200,
    temperature: 0.2,
    reasoning: { effort: "low", exclude: true },
  };
}

/** Calls OpenRouter and returns a stream of plain answer text (SSE parsed on the server). */
export async function streamCompletion(messages: ChatMessage[], opts: { apiKey?: string; models?: string[]; fetchImpl?: typeof fetch; timeoutMs?: number; referer?: string } = {}): Promise<{ stream: ReadableStream<Uint8Array>; model: string | null }> {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AiUpstreamError(503, FRIENDLY.config);
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  let res: Response;
  try {
    res = await doFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": opts.referer ?? "https://icu360.in",
        "X-Title": "ICU 360",
      },
      body: JSON.stringify(requestBody(messages, opts.models ?? modelList())),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    clearTimeout(timer);
    throw new AiUpstreamError(504, (e as Error)?.name === "AbortError" ? FRIENDLY.timeout : FRIENDLY.down);
  }
  if (!res.ok || !res.body) {
    clearTimeout(timer);
    if (res.status === 429) throw new AiUpstreamError(429, FRIENDLY.busy);
    if (res.status === 401 || res.status === 403) throw new AiUpstreamError(503, FRIENDLY.config);
    throw new AiUpstreamError(502, FRIENDLY.down);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { finish(ctrl); return; }
          buf += dec.decode(value, { stream: true });
          let out = "";
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue; // comments like ": OPENROUTER PROCESSING"
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const j = JSON.parse(data);
              if (j.error) { out += sent + out.length ? `\n\n${FRIENDLY.down}` : (j.error.code === 429 ? FRIENDLY.busy : FRIENDLY.down); continue; }
              const c = j.choices?.[0]?.delta?.content;
              if (typeof c === "string") out += c;
            } catch { /* partial or non-JSON line */ }
          }
          if (out) { sent += out.length; ctrl.enqueue(enc.encode(out)); return; }
        }
      } catch (e) {
        if (!sent) ctrl.enqueue(enc.encode((e as Error)?.name === "AbortError" ? FRIENDLY.timeout : FRIENDLY.down));
        else ctrl.enqueue(enc.encode("\n\n(Answer cut short. Please try again.)"));
        finish(ctrl);
      }
    },
    cancel() { clearTimeout(timer); controller.abort(); },
  });
  function finish(ctrl: ReadableStreamDefaultController<Uint8Array>) {
    clearTimeout(timer);
    if (!sent) ctrl.enqueue(enc.encode(FRIENDLY.down));
    ctrl.close();
  }
  return { stream, model: res.headers.get("x-model") };
}
