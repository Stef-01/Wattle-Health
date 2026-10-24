"use client";
// The admin dashboard's interactive parts. Every action is a same-origin fetch to /api/decisions
// (the admin cookie rides along); the server re-renders the page with router.refresh().
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Candidate, CaseStudy, Category, CategoryGroup } from "@/src/decisions/types";
import { CATEGORY_GROUPS, GROUP_LABELS } from "@/src/decisions/types";
import type { ClassifyResult } from "@/src/decisions/engine";
import { Button, FieldBox } from "@/src/ui/kit";
import { ScoreBar } from "./bits";

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

const inputCls = "block w-full bg-transparent px-4 py-3 text-body text-ink outline-none placeholder:text-grey";

export function SignIn({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!enabled) return <p className="text-body text-grey">Admin is off. Set ADMIN_PASSWORD in the environment (and DECISIONS_API_KEY for outside tools), then reload.</p>;
  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await call("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) });
          const next = new URLSearchParams(window.location.search).get("next");
          router.replace(next && next.startsWith("/admin") ? next : "/admin");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <FieldBox>
        <label className="sr-only" htmlFor="admin-password">Password</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={inputCls} />
      </FieldBox>
      <Button type="submit" disabled={busy || !password}>Sign in</Button>
      {error ? <p role="alert" className="text-subhead text-ink">{error}</p> : null}
    </form>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <Button kind="plain" size="small" onClick={async () => { await call("/api/admin/session", { method: "DELETE" }); router.replace("/admin/login"); }}>
      Sign out
    </Button>
  );
}

/** Run one transcript through the whole loop: scores, decision, new candidates. */
export function TryTranscript({ labels }: { labels: Record<string, string> }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ClassifyResult | null>(null);
  const [all, setAll] = useState(false);
  const sorted = res ? Object.entries(res.scores).sort((a, b) => b[1] - a[1]) : [];
  return (
    <div className="flex flex-col gap-3">
      <FieldBox>
        <label className="sr-only" htmlFor="transcript">Transcript</label>
        <textarea id="transcript" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a transcript or a case summary" className={`${inputCls} resize-y`} />
      </FieldBox>
      <div className="flex items-center gap-3">
        <Button
          size="medium"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setRes(await call<ClassifyResult>("/api/decisions/classify", { method: "POST", body: JSON.stringify({ transcript: text }) }));
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Classifying…" : "Classify"}
        </Button>
        {res ? <span className="text-footnote text-grey">{res.categories} categories · {res.model} · {(res.ms / 1000).toFixed(1)} s</span> : null}
      </div>
      {error ? <p role="alert" className="text-subhead text-ink">{error}</p> : null}
      {res ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-card bg-surface-soft px-4 py-3">
            <p className="text-footnote text-grey">Decision</p>
            {res.decision ? (
              <>
                <p className="mt-0.5 text-title2 text-ink">{res.decision.decision}</p>
                <p className="text-subhead text-grey">{Math.round(res.decision.confidence * 100)}% of the training cases in this leaf · tree v{res.decision.modelVersion}{res.decision.stale ? " · categories changed since training, retrain" : ""}</p>
                {res.decision.path.length ? <p className="mt-2 text-subhead text-charcoal">{res.decision.path.join(" → ")}</p> : null}
              </>
            ) : (
              <p className="mt-0.5 text-body text-grey">No tree yet. Add case studies and train.</p>
            )}
          </div>
          <div>
            <p className="text-headline text-ink">Scores</p>
            {(all ? sorted : sorted.filter(([, v]) => v > 0.05).slice(0, 15)).map(([k, v]) => <ScoreBar key={k} label={labels[k] ?? k} value={v} sub={k} />)}
            <Button kind="plain" size="small" onClick={() => setAll((x) => !x)}>{all ? "Show the top" : `Show all ${sorted.length}`}</Button>
          </div>
          <div>
            <p className="text-headline text-ink">Not covered by any category</p>
            {res.candidates.length ? (
              <ul className="mt-1 flex flex-col gap-1">{res.candidates.map((c) => <li key={c.id} className="text-subhead text-charcoal">{c.label} <span className="text-grey">({c.seen === 1 ? "new, in review" : `seen ${c.seen} times`})</span></li>)}</ul>
            ) : (
              <p className="mt-1 text-subhead text-grey">Nothing new.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupSelect({ value, onChange, id }: { value: CategoryGroup; onChange: (g: CategoryGroup) => void; id: string }) {
  return (
    <FieldBox>
      <label className="sr-only" htmlFor={id}>Group</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as CategoryGroup)} className={`${inputCls} min-h-11`}>
        {CATEGORY_GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
      </select>
    </FieldBox>
  );
}

/** One candidate in the review queue: rename, describe, choose its group, then approve or reject. */
export function ReviewCard({ c }: { c: Candidate }) {
  const router = useRouter();
  const [label, setLabel] = useState(c.label);
  const [description, setDescription] = useState(c.description);
  const [group, setGroup] = useState<CategoryGroup>(c.group);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: "approve" | "reject" | "update") => {
    setBusy(true);
    setError(null);
    try {
      await call(`/api/decisions/candidates/${encodeURIComponent(c.id)}`, { method: "PATCH", body: JSON.stringify({ action, label, description, group }) });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const done = c.status !== "pending";
  return (
    <article className="rounded-card bg-surface-soft px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-footnote text-grey">{c.status === "pending" ? "Waiting for review" : c.status === "approved" ? `Approved as ${c.categoryKey}` : "Rejected"} · raised {c.seen} {c.seen === 1 ? "time" : "times"}</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_200px]">
        <FieldBox>
          <label className="sr-only" htmlFor={`l-${c.id}`}>Category name</label>
          <input id={`l-${c.id}`} value={label} onChange={(e) => setLabel(e.target.value)} disabled={done} className={inputCls} />
        </FieldBox>
        <GroupSelect id={`g-${c.id}`} value={group} onChange={setGroup} />
      </div>
      <FieldBox className="mt-3">
        <label className="sr-only" htmlFor={`d-${c.id}`}>Description</label>
        <textarea id={`d-${c.id}`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={done} placeholder="What this category means" className={`${inputCls} resize-y`} />
      </FieldBox>
      {c.evidence.length ? (
        <ul className="mt-3 flex flex-col gap-1">{c.evidence.map((e) => <li key={e} className="border-l-2 border-hairline pl-3 text-subhead text-charcoal">“{e}”</li>)}</ul>
      ) : null}
      {done ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="small" disabled={busy || !label.trim()} onClick={() => void act("approve")}>Approve as category</Button>
          <Button size="small" kind="gray" disabled={busy} onClick={() => void act("update")}>Save edits</Button>
          <Button size="small" kind="gray" disabled={busy} onClick={() => void act("reject")}>Reject</Button>
        </div>
      )}
      {error ? <p role="alert" className="mt-2 text-subhead text-ink">{error}</p> : null}
    </article>
  );
}

/** A reviewed category: rename, redescribe, switch off. */
export function CategoryEditor({ c }: { c: Category }) {
  const router = useRouter();
  const [label, setLabel] = useState(c.label);
  const [description, setDescription] = useState(c.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Partial<Pick<Category, "label" | "description" | "active">>) => {
    setBusy(true);
    setError(null);
    try {
      await call(`/api/decisions/categories/${encodeURIComponent(c.key)}`, { method: "PATCH", body: JSON.stringify(patch) });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="grid gap-2 md:grid-cols-[240px_1fr]">
        <FieldBox>
          <label className="sr-only" htmlFor={`cl-${c.key}`}>Name</label>
          <input id={`cl-${c.key}`} value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
        </FieldBox>
        <FieldBox>
          <label className="sr-only" htmlFor={`cd-${c.key}`}>Description</label>
          <input id={`cd-${c.key}`} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </FieldBox>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" disabled={busy || (label === c.label && description === c.description)} onClick={() => void save({ label, description })}>Save</Button>
        <Button size="small" kind="gray" disabled={busy} onClick={() => void save({ active: !c.active })}>{c.active ? "Switch off" : "Switch on"}</Button>
        <span className="text-footnote text-grey">{c.key}{c.active ? "" : " · off: not scored"}</span>
      </div>
      {error ? <p role="alert" className="text-subhead text-ink">{error}</p> : null}
    </div>
  );
}

/** Add one case study, or paste many as JSON. */
export function AddCases() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [decision, setDecision] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const post = async (payload: unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      const out = await call<CaseStudy[]>("/api/decisions/cases", { method: "POST", body: JSON.stringify(payload) });
      setMsg(`Saved ${out.length} ${out.length === 1 ? "case" : "cases"}.`);
      setTitle("");
      setText("");
      setDecision("");
      setBulk("");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <FieldBox><label className="sr-only" htmlFor="case-title">Title</label><input id="case-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputCls} /></FieldBox>
      <FieldBox><label className="sr-only" htmlFor="case-text">Case</label><textarea id="case-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened: the case as the notes tell it" className={`${inputCls} resize-y`} /></FieldBox>
      <FieldBox><label className="sr-only" htmlFor="case-decision">Decision</label><input id="case-decision" value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="The decision it reached, e.g. Refer to psychiatrist" className={inputCls} /></FieldBox>
      <Button size="medium" disabled={busy || !text.trim() || !decision.trim()} onClick={() => void post({ title, text, decision, source: "manual" })}>Add case</Button>
      <details className="mt-2">
        <summary className="hit flex min-h-11 cursor-pointer items-center text-subhead text-accent">Paste many as JSON</summary>
        <FieldBox className="mt-2"><label className="sr-only" htmlFor="case-bulk">JSON</label><textarea id="case-bulk" rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder='[{"title": "…", "text": "…", "decision": "…", "source": "granola", "sourceRef": "note id"}]' className={`${inputCls} resize-y font-mono text-subhead`} /></FieldBox>
        <Button size="small" className="mt-2" disabled={busy || !bulk.trim()} onClick={() => { try { void post(JSON.parse(bulk)); } catch { setMsg("That isn’t valid JSON."); } }}>Import</Button>
      </details>
      {msg ? <p role="status" className="text-subhead text-ink">{msg}</p> : null}
    </div>
  );
}

export function TrainButton({ cases }: { cases: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="medium"
        disabled={busy || cases === 0}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const out = await call<{ model: { version: number; trainingAccuracy: number; leaveOneOutAccuracy: number | null } }>("/api/decisions/train", { method: "POST" });
            setMsg(`Tree v${out.model.version}: ${Math.round(out.model.trainingAccuracy * 100)}% on the cases${out.model.leaveOneOutAccuracy !== null ? `, ${Math.round(out.model.leaveOneOutAccuracy * 100)}% with each held out` : ""}.`);
            router.refresh();
          } catch (err) {
            setMsg((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Training…" : "Train the tree"}
      </Button>
      {msg ? <span role="status" className="text-subhead text-ink">{msg}</span> : null}
    </div>
  );
}

export function RemoveCase({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button kind="plain" size="small" onClick={async () => { if (!window.confirm("Remove this case study?")) return; await call(`/api/decisions/cases/${encodeURIComponent(id)}`, { method: "DELETE" }); router.refresh(); }}>
      Remove
    </Button>
  );
}

type Draft = { title: string; text: string; decision: string; keep: boolean };

/** Paste meeting notes (a Granola note, say); the model drafts the case studies; a person checks and saves them. */
export function ImportNotes() {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [ref, setRef] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const edit = (i: number, patch: Partial<Draft>) => setDrafts((d) => (d ? d.map((x, j) => (j === i ? { ...x, ...patch } : x)) : d));
  return (
    <div className="flex flex-col gap-3">
      <FieldBox><label className="sr-only" htmlFor="notes-ref">Note title</label><input id="notes-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Note title or date (kept as the source)" className={inputCls} /></FieldBox>
      <FieldBox><label className="sr-only" htmlFor="notes">Meeting notes</label><textarea id="notes" rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste the meeting notes" className={`${inputCls} resize-y`} /></FieldBox>
      <Button
        size="medium"
        disabled={busy || !notes.trim()}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const out = await call<{ cases: Omit<Draft, "keep">[] }>("/api/decisions/cases/extract", { method: "POST", body: JSON.stringify({ notes }) });
            setDrafts(out.cases.map((c) => ({ ...c, keep: true })));
            if (!out.cases.length) setMsg("No case studies with a decision in these notes.");
          } catch (err) {
            setMsg((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && !drafts ? "Reading the notes…" : "Find the case studies"}
      </Button>
      {drafts?.length ? (
        <div className="flex flex-col gap-3">
          {drafts.map((d, i) => (
            <div key={i} className="rounded-card bg-surface-soft px-4 py-3">
              <label className="flex min-h-11 items-center gap-2 text-subhead text-ink"><input type="checkbox" checked={d.keep} onChange={(e) => edit(i, { keep: e.target.checked })} className="size-5" /> Keep this case</label>
              <FieldBox className="mt-1"><label className="sr-only" htmlFor={`dt-${i}`}>Title</label><input id={`dt-${i}`} value={d.title} onChange={(e) => edit(i, { title: e.target.value })} className={inputCls} /></FieldBox>
              <FieldBox className="mt-2"><label className="sr-only" htmlFor={`dx-${i}`}>Case</label><textarea id={`dx-${i}`} rows={4} value={d.text} onChange={(e) => edit(i, { text: e.target.value })} className={`${inputCls} resize-y`} /></FieldBox>
              <FieldBox className="mt-2"><label className="sr-only" htmlFor={`dd-${i}`}>Decision</label><input id={`dd-${i}`} value={d.decision} onChange={(e) => edit(i, { decision: e.target.value })} className={inputCls} /></FieldBox>
            </div>
          ))}
          <Button
            size="medium"
            disabled={busy || !drafts.some((d) => d.keep)}
            onClick={async () => {
              setBusy(true);
              try {
                const keep = drafts.filter((d) => d.keep).map((d) => ({ title: d.title, text: d.text, decision: d.decision, source: "granola", ...(ref.trim() ? { sourceRef: `${ref.trim()} · ${d.title}` } : {}) }));
                const out = await call<CaseStudy[]>("/api/decisions/cases", { method: "POST", body: JSON.stringify(keep) });
                setMsg(`Saved ${out.length} ${out.length === 1 ? "case" : "cases"}. Train the tree to use them.`);
                setDrafts(null);
                setNotes("");
                router.refresh();
              } catch (err) {
                setMsg((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save {drafts.filter((d) => d.keep).length} {drafts.filter((d) => d.keep).length === 1 ? "case" : "cases"}
          </Button>
        </div>
      ) : null}
      {msg ? <p role="status" className="text-subhead text-ink">{msg}</p> : null}
    </div>
  );
}

