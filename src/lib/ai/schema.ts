import { z } from "zod";

/** What the learner asked the tutor to do. Only these are accepted by /api/ai. */
export const AI_ACTIONS = ["summarise", "explain", "followup", "why_wrong", "explain_state"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

/** What kind of on-screen content the context text came from (changes the wording of the prompt, nothing else). */
export const AI_KINDS = ["algorithm", "topic", "notes", "module", "guide", "news", "calculator", "tool", "quiz", "ecg", "ventilator", "abg", "drug", "page"] as const;
export type AiKind = (typeof AI_KINDS)[number];

export const AI_LIMITS = { title: 200, context: 12_000, question: 500 } as const;

export const ACTION_LABELS: Record<AiAction, string> = {
  summarise: "Summarise",
  explain: "Explain in more detail",
  followup: "Follow-up question",
  why_wrong: "Why was I wrong?",
  explain_state: "Explain this",
};

/** The on-screen text a page hands to the AI tutor. Pages build this from their own content data (see ./context.ts). */
export interface AiContext {
  kind: AiKind;
  /** Short heading shown in the panel and sent to the model, e.g. the algorithm or calculator name. */
  title: string;
  /** Plain text of exactly what is on screen for this block. */
  text: string;
  /** Actions offered as buttons. Defaults depend on the kind (see defaultActions). */
  actions?: AiAction[];
}

export function defaultActions(kind: AiKind): AiAction[] {
  if (kind === "quiz") return ["why_wrong", "explain"];
  if (kind === "ecg" || kind === "ventilator" || kind === "abg" || kind === "calculator" || kind === "tool") return ["explain_state", "summarise"];
  return ["summarise", "explain"];
}

const RequestSchema = z.object({
  action: z.enum(AI_ACTIONS),
  kind: z.enum(AI_KINDS),
  title: z.string().trim().min(1).max(AI_LIMITS.title),
  context: z.string().trim().min(1).max(AI_LIMITS.context),
  question: z.string().trim().max(AI_LIMITS.question).optional(),
}).strict();

export type AiRequest = z.infer<typeof RequestSchema>;

export function validateAiRequest(body: unknown): { ok: true; value: AiRequest } | { ok: false; error: string } {
  const r = RequestSchema.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue?.path.join(".") || "body";
    if (issue?.code === "too_big") return { ok: false, error: `The ${field} is too long.` };
    return { ok: false, error: `Invalid ${field}.` };
  }
  const v = r.data;
  if (v.action === "followup" && !v.question) return { ok: false, error: "Type a question first." };
  if (v.action !== "followup" && v.question) return { ok: false, error: "A question is only allowed with a follow-up." };
  return { ok: true, value: v };
}
