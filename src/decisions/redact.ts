// Personal details come out of a transcript before it leaves for the classifier (founder 2026-10-24).
// The redactor is `pipeline/redact/redact.py`: patterns, then a Bedrock model kept in Australia
// (an `au.` profile or a Sydney-only model) that points at names, addresses, dates of birth and
// named organisations for code to replace, then guards that keep places and clinical words.
// It fails closed: if redaction is required and does not succeed, nothing is sent.
import { spawn } from "node:child_process";
import path from "node:path";
import { DecisionsUnavailable } from "./openai";

export type Redaction = { text: string; counts: Record<string, number>; model: string; ms: number };

/** On when Bedrock credentials are present, and always in production; REDACT_MODE=off turns it off locally. */
export function redactionRequired(): boolean {
  const mode = process.env.REDACT_MODE?.trim();
  if (mode === "off" && process.env.NODE_ENV !== "production") return false;
  return mode === "on" || process.env.NODE_ENV === "production" || Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK?.trim());
}

export async function redact(text: string, timeoutMs = 90_000): Promise<Redaction> {
  const started = Date.now();
  const script = path.join(process.cwd(), "pipeline", "redact", "redact.py");
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.env.REDACT_PYTHON?.trim() || "python3", [script], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => reject(new DecisionsUnavailable(`redaction unavailable: ${e.message}`)));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new DecisionsUnavailable(`redaction failed, transcript not sent: ${stderr.trim().slice(0, 300) || `exit ${code}`}`));
    });
    child.stdin.end(JSON.stringify({ text }));
  });
  const parsed = JSON.parse(out) as Omit<Redaction, "ms">;
  return { ...parsed, ms: Date.now() - started };
}

/** The text to send: redacted when required, unchanged otherwise. */
export async function outbound(text: string): Promise<{ text: string; redaction: Redaction | null }> {
  if (!redactionRequired()) return { text, redaction: null };
  const redaction = await redact(text);
  return { text: redaction.text, redaction };
}
