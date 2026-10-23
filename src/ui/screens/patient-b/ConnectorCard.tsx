"use client";
import { Brand } from "@/src/ui/brand";
// Wattle as an app connector for Claude and ChatGPT (founder 2026-10-19: "make the connector look
// like a real app MCP connector"). A connector tile like the ones in Claude's and ChatGPT's
// directories: app icon, name, what it can do (its MCP tools), what it can't, a live status read
// from the server's own MCP handshake, and one-tap "Add to" buttons that open each app's connector
// settings with the server URL ready to paste.
import { useEffect, useState } from "react";
import { Orb } from "@/src/ui/kit/Orb";

const TOOLS = [
  { name: "search_doctors", what: "Find Australian doctors from one sentence, with why each one fits" },
  { name: "get_doctor", what: "Read a doctor’s profile: their own words, hobbies, location and next opening" },
];

export function ConnectorCard({ origin }: { origin: string }) {
  const url = `${origin}/api/mcp`;
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [version, setVersion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "wattle-settings", version: "1" } } }) })
      .then((r) => r.json())
      .then((j: { result?: { serverInfo?: { version?: string } } }) => {
        setStatus(j.result ? "online" : "offline");
        setVersion(j.result?.serverInfo?.version ?? null);
      })
      .catch(() => setStatus("offline"));
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <section className="mt-6 overflow-hidden rounded-card bg-surface-soft">
      <div className="flex items-start gap-4 px-5 pb-4 pt-5">
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-card bg-surface-soft ring-1 ring-black/5"><Orb size={36} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-semibold text-ink"><Brand /></p>
            <span className="rounded-[10px] bg-surface-soft px-1.5 py-0.5 text-caption2 font-semibold text-grey">MCP</span>
          </div>
          <p className="text-subhead text-grey">Find a doctor who fits you, from inside your assistant</p>
          <p className="mt-1 flex items-center gap-1.5 text-footnote text-grey">
            <span className={`inline-block size-2 rounded-full ${status === "online" ? "bg-ink" : status === "offline" ? "bg-[#d70015]" : "bg-[#bdbdbd]"}`} />
            {status === "online" ? `Online${version ? ` · v${version}` : ""} · read-only · no sign-in` : status === "offline" ? "Unreachable right now" : "Checking…"}
          </p>
        </div>
      </div>

      <div className="border-t border-hairline px-5 py-4">
        <p className="text-footnote font-semibold text-grey">Tools</p>
        <ul className="mt-2 flex flex-col gap-2.5">
          {TOOLS.map((t) => (
            <li key={t.name} className="flex gap-3">
              <code className="shrink-0 rounded-[10px] bg-surface-soft px-1.5 py-0.5 text-caption1 text-ink">{t.name}</code>
              <span className="text-subhead leading-read text-grey">{t.what}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-footnote leading-read text-grey">Can’t book, message or see anything about you. Your assistant sends only the sentence you ask it to search.</p>
      </div>

      <div className="border-t border-hairline px-5 py-4">
        <p className="text-footnote font-semibold text-grey">Server URL</p>
        <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-white py-1 pl-3 pr-1">
          <code className="min-w-0 flex-1 truncate text-footnote text-ink">{url}</code>
          <button type="button" onClick={() => void copy()} className="press shrink-0 rounded-[10px] bg-white px-3 py-1.5 text-footnote text-ink ring-1 ring-black/10">{copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer" onClick={() => void copy()} className="press inline-flex h-11 items-center justify-center rounded-[10px] bg-ink text-subhead font-semibold text-white">Add to Claude</a>
          <a href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noreferrer" onClick={() => void copy()} className="press inline-flex h-11 items-center justify-center rounded-[10px] border border-ink text-subhead font-semibold text-ink">Add to ChatGPT</a>
        </div>
        <p className="mt-2 text-caption1 leading-read text-grey">Opens the app’s connector settings with the URL copied. Choose “Add custom connector” and paste.</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-footnote text-grey">Using a custom GPT instead?</summary>
          <p className="mt-2 text-footnote text-grey">GPT editor › Actions › Import from URL: <code className="text-ink">{origin}/api/openapi.json</code></p>
        </details>
      </div>
    </section>
  );
}
