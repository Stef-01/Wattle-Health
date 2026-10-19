"use client";
// Settings › Your health context (2026-10-18). Two ways to bring what an assistant knows about you:
// 1. Ask ChatGPT for a short summary (prompt provided), paste it here; Wattle reads it on its server
//    without any model, shows what it understood as switches, and keeps it on this device only.
// 2. Use Wattle inside ChatGPT or Claude: add the MCP connector or the GPT Action, and your own
//    assistant searches Wattle with everything it already knows. No API key on Wattle's side.
import { useEffect, useState } from "react";
import { ArrowLeft, Circle, Cta, Screen } from "@/src/ui/kit";
import { CHATGPT_PROMPT, getContext, setContext, type ContextItem, type HealthContext } from "@/src/ui/context";

const KIND: Record<string, string> = { condition: "Health", population: "Who it’s for", must: "Must have", preference: "Preference", human: "How they work" };

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="press inline-flex h-10 items-center rounded-[6px] border border-ink px-4 text-[14px] font-medium text-ink"
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function ContextSettings() {
  const [saved, setSaved] = useState<HealthContext | null>(null);
  const [text, setText] = useState("");
  const [items, setItems] = useState<ContextItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("https://wattlehealth.vercel.app");

  useEffect(() => {
    const c = getContext();
    setSaved(c);
    if (c) {
      setText(c.text);
      setItems(c.items);
    }
    setOrigin(window.location.origin);
  }, []);

  async function read() {
    setBusy(true);
    try {
      const res = await fetch("/api/context/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const data = (await res.json()) as { items: Omit<ContextItem, "on">[] };
      setItems(data.items.map((i) => ({ ...i, on: true })));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!items) return;
    const c: HealthContext = { text, items, source: "chatgpt", updatedAt: new Date().toISOString() };
    setContext(c);
    setSaved(c);
  }

  function clear() {
    setContext(null);
    setSaved(null);
    setText("");
    setItems(null);
  }

  const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(CHATGPT_PROMPT)}`;

  return (
    <Screen padBottom="pb-[140px]">
      <div className="flex h-11 items-center gap-4">
        <Circle href="/me" label="Back"><ArrowLeft size={20} /></Circle>
        <h1 className="text-[22px] text-ink">Your health context</h1>
      </div>
      <p className="mt-5 text-[16px] leading-[1.5] text-charcoal">Tell us about your health so your matches fit. It stays on this phone.</p>

      <section className="mt-8 rounded-[8px] px-5 py-5" style={{ background: "#f5f8f6" }}>
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#2f5d3a]">Bring it from ChatGPT</p>
        <ol className="mt-3 flex flex-col gap-4 text-[15px] leading-[1.5] text-charcoal">
          <li>
            <span className="font-semibold text-ink">1. Ask ChatGPT for a short summary.</span>
            <span className="mt-2 flex flex-wrap gap-2">
              <a href={chatgptUrl} target="_blank" rel="noreferrer" className="press inline-flex h-10 items-center rounded-[6px] bg-ink px-4 text-[14px] font-semibold text-white">Open ChatGPT with the prompt</a>
              <Copy text={CHATGPT_PROMPT} label="Copy the prompt" />
            </span>
          </li>
          <li>
            <span className="font-semibold text-ink">2. Paste what it wrote.</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} placeholder="For example: I’m in my 30s with endometriosis and pelvic pain. I prefer telehealth and a woman doctor who listens and explains things plainly." className="field mt-2 w-full rounded-[6px] border border-line bg-white p-3 text-[15px] outline-none" />
            <button type="button" disabled={!text.trim() || busy} onClick={() => void read()} className="press mt-2 inline-flex h-10 items-center rounded-[6px] border border-ink bg-white px-4 text-[14px] font-medium text-ink disabled:opacity-50">{busy ? "Reading" : "Read it"}</button>
          </li>
        </ol>
        {items ? (
          <div className="mt-5">
            <p className="text-[15px] font-semibold text-ink">3. What Wattle understood</p>
            {items.length === 0 ? <p className="mt-2 text-[14px] text-grey">Nothing to search on yet. Mention a condition, who it’s for, or how you like a doctor to work.</p> : null}
            <ul className="mt-2 flex flex-col">
              {items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-4 border-b border-[#e3ebe5] py-3 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] text-ink">{it.label}</span>
                    <span className="block text-[13px] text-grey">{KIND[it.kind] ?? "Context"}</span>
                  </span>
                  <button type="button" role="switch" aria-checked={it.on} aria-label={`Use ${it.label}`} onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200" style={{ background: it.on ? "#2f5d3a" : "#e3e3e3" }}>
                    <span className="absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200" style={{ transform: `translateX(${it.on ? 22 : 2}px)` }} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4"><Cta fixed={false} onClick={save}>{saved ? "Update my context" : "Use this in my searches"}</Cta></div>
            {saved ? <p className="mt-2 text-center text-[13px] text-grey">Saved on this device {new Date(saved.updatedAt).toLocaleDateString("en-AU")}.</p> : null}
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-[8px] border border-hairline px-5 py-5">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-grey">Use Wattle inside ChatGPT or Claude</p>
        <p className="mt-2 text-[15px] leading-[1.5] text-charcoal">Your assistant already knows your context. Connect Wattle, then ask it to find you a doctor. It searches Wattle with what it knows.</p>
        <dl className="mt-4 flex flex-col gap-4 text-[14px]">
          <div>
            <dt className="font-semibold text-ink">ChatGPT or Claude connector (MCP)</dt>
            <dd className="mt-1 text-grey">Settings › Connectors › Add, then paste this URL.</dd>
            <dd className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded-[4px] bg-surface px-3 py-2 text-[13px] text-ink">{origin}/api/mcp</code><Copy text={`${origin}/api/mcp`} label="Copy" /></dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Custom GPT Action</dt>
            <dd className="mt-1 text-grey">In the GPT editor › Actions › Import from URL.</dd>
            <dd className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded-[4px] bg-surface px-3 py-2 text-[13px] text-ink">{origin}/api/openapi.json</code><Copy text={`${origin}/api/openapi.json`} label="Copy" /></dd>
          </div>
        </dl>
      </section>

      {saved ? (
        <button type="button" onClick={clear} className="press-dim mt-6 text-[15px] text-danger">Delete my health context</button>
      ) : null}
    </Screen>
  );
}
