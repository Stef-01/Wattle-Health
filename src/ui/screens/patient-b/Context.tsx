"use client";
import { Brand } from "@/src/ui/brand";
import { ConnectorCard } from "./ConnectorCard";
// Settings › Your health context (2026-10-18). Two ways to bring what an assistant knows about you:
// 1. Ask ChatGPT for a short summary (prompt provided), paste it here; Wattle reads it on its server
//    without any model, shows what it understood as switches, and keeps it on this device only.
// 2. Use Wattle inside ChatGPT or Claude: add the MCP connector or the GPT Action, and your own
//    assistant searches Wattle with everything it already knows. No API key on Wattle's side.
import { useEffect, useState } from "react";
import { Button, Cta, NavBar, Screen, Toggle } from "@/src/ui/kit";
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
      className="press inline-flex h-11 items-center rounded-full bg-white px-4 text-subhead font-semibold text-ink"
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

  const [confirming, setConfirming] = useState(false);
  function clear() {
    setContext(null);
    setSaved(null);
    setText("");
    setItems(null);
  }

  const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(CHATGPT_PROMPT)}`;

  return (
    <Screen padBottom="pb-[140px]">
      <NavBar back="/me" title="Health context" />
      <p className="mt-2 text-body text-grey">Tell us about your health so your picks fit. It stays on this phone.</p>

      <section className="mt-8 rounded-card px-5 py-5" style={{ background: "var(--color-surface-soft)" }}>
        <p className="text-footnote text-ink">Bring it from ChatGPT</p>
        <ol className="mt-3 flex flex-col gap-4 text-subhead leading-read text-charcoal">
          <li>
            <span className="text-ink">1. Ask ChatGPT for a short summary.</span>
            <span className="mt-2 flex flex-wrap gap-2">
              <a href={chatgptUrl} target="_blank" rel="noreferrer" className="press inline-flex h-11 items-center rounded-full bg-white px-4 text-subhead font-semibold text-ink">Open ChatGPT with the prompt</a>
              <Copy text={CHATGPT_PROMPT} label="Copy the prompt" />
            </span>
          </li>
          <li>
            <span className="text-ink">2. Paste what it wrote.</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} placeholder="For example: I’m in my 30s with endometriosis and pelvic pain. I prefer telehealth and a woman doctor who listens and explains things plainly." className="field mt-2 w-full rounded-field bg-white px-4 py-3 text-body outline-none" />
            <button type="button" disabled={!text.trim() || busy} onClick={() => void read()} className="press mt-2 inline-flex h-11 items-center rounded-full bg-ink px-5 text-subhead font-semibold text-white disabled:opacity-[.32]">{busy ? "Reading…" : "Read it"}</button>
          </li>
        </ol>
        {items ? (
          <div className="mt-5">
            <p className="text-subhead text-ink">3. What <Brand /> understood</p>
            {items.length === 0 ? <p className="mt-2 text-subhead text-grey">Nothing to search on yet. Mention a condition, who it’s for, or how you like a doctor to work.</p> : null}
            <ul className="mt-2 flex flex-col">
              {items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-4 border-b border-hairline py-3 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-ink">{it.label}</span>
                    <span className="block text-footnote text-grey">{KIND[it.kind] ?? "Context"}</span>
                  </span>
                  <Toggle on={it.on} label={`Use ${it.label}`} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, on: v } : x)))} />
                </li>
              ))}
            </ul>
            <div className="mt-4"><Cta fixed={false} onClick={save}>{saved ? "Update my context" : "Use this in my searches"}</Cta></div>
            {saved ? <p className="mt-2 text-center text-footnote text-grey">Saved on this device {new Date(saved.updatedAt).toLocaleDateString("en-AU")}.</p> : null}
          </div>
        ) : null}
      </section>

      <ConnectorCard origin={origin} />

      {saved ? (
        confirming ? (
          <div className="mt-6 flex items-center gap-2">
            <span className="flex-1 text-subhead text-grey">Delete it from this phone?</span>
            <Button kind="gray" size="small" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="small" className="bg-danger" onClick={() => { clear(); setConfirming(false); }}>Delete</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="press-dim mt-6 inline-flex h-11 items-center text-subhead text-danger">Delete my health context</button>
        )
      ) : null}
    </Screen>
  );
}
