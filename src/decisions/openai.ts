// The one model call site (founder 2026-10-24: API keys allowed). OpenAI Responses API with a
// strict JSON schema, so the output always parses and always has every required field. The key
// is server-only (OPENAI_API_KEY, never NEXT_PUBLIC_) and is read per call, so rotating it in the
// environment needs no code change.
export class DecisionsUnavailable extends Error {}

export function openaiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
}

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type Output = { type: string; content?: { type: string; text?: string; refusal?: string }[] };

export async function structured<T>(name: string, schema: Record<string, unknown>, developer: string, user: string, timeoutMs = 90_000): Promise<T> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new DecisionsUnavailable("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: openaiModel(),
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT?.trim() || "low" },
      // Transcripts can carry health details: OpenAI is told not to keep them for its own use.
      store: false,
      input: [
        { role: "developer", content: developer },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { output?: Output[]; error?: { message?: string } };
  if (!res.ok) throw new DecisionsUnavailable(`OpenAI ${res.status}: ${body.error?.message ?? "request failed"}`);
  const part = body.output?.find((o) => o.type === "message")?.content?.[0];
  if (!part) throw new DecisionsUnavailable("OpenAI returned no message");
  if (part.type === "refusal") throw new DecisionsUnavailable(`OpenAI refused: ${part.refusal ?? ""}`);
  return JSON.parse(part.text ?? "{}") as T;
}
