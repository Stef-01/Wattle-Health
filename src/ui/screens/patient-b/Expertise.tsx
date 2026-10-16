"use client";
// P07 Clinical expertise (226:132): back circle + Poppins title, three pills as tabs
// (Conditions / Research / Training), check items from the doctor's closed conditions, the
// Research title row with "View all", book rows per verified publication, CTA "Contact practice".
import { useState } from "react";
import type { DoctorRecord } from "@/src/data/types";
import { Body, Divider, Fade, FigmaIcon, Screen, SourceRow, TopBar } from "@/src/ui/kit";
import { Space } from "./bits";
import { listSentence, niceSource, TIER_WORD, verifiedPublications } from "./facts";
import { ContactCta } from "./ProfileClient";
import { doctorSlug } from "@/src/data/doctor-slug";

type Tab = "Conditions" | "Research" | "Training";

export function Expertise({ doctor: d, labels }: { doctor: DoctorRecord; labels: Record<string, string> }) {
  const [tab, setTab] = useState<Tab>("Conditions");
  const id = doctorSlug(d.id);
  const pubs = verifiedPublications(d);
  const ids = d.conditions.value;
  const conditions = ids.length > 0 ? ids.map((c) => labels[c] ?? c.replace(/-/g, " ")) : d.focusTags.value;
  const src = d.conditions;
  const badge = `${niceSource(src.source)}, ${TIER_WORD[src.tier]} ${src.observedAt.slice(0, 10)}`;

  const training: { title: string; sub: string; href: string | null }[] = [];
  if (d.register) {
    for (const q of d.register.qualifications?.value ?? []) training.push({ title: q, sub: `Ahpra register, ${d.register.status.observedAt.slice(0, 10)}`, href: d.register.registerUrl });
    for (const e of d.register.endorsements?.value ?? []) training.push({ title: e, sub: `Ahpra endorsement, ${d.register.status.observedAt.slice(0, 10)}`, href: d.register.registerUrl });
    for (const f of d.register.fieldOfPractice?.value ?? []) training.push({ title: f, sub: `Ahpra field of practice`, href: d.register.registerUrl });
  }
  if (d.credential) training.push({ title: d.credential, sub: badge, href: src.sourceUrl ?? null });

  const research = (list: typeof pubs) =>
    list.map((p) => (
      <div key={p.title}>
        <SourceRow icon={<FigmaIcon name="book" size={17} />} title={p.title} sub={[p.venue, p.year].filter(Boolean).join(", ") || "Venue not recorded"} href={p.url} />
        <Divider />
      </div>
    ));

  return (
    <Screen padBottom="pb-[140px]">
      <TopBar title="Clinical expertise" back={`/doctor/${id}`} />
      <Space h={30} />
      <div className="flex gap-6 border-b border-divider">
        {(["Conditions", "Research", "Training"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`press-soft press -mb-px border-b-2 pb-3 text-[16px] ${tab === t ? "border-ink text-ink" : "border-transparent text-grey"}`}>{t}</button>
        ))}
      </div>
      <Space h={30} />

      {tab === "Conditions" ? (
        <>
          {conditions.length === 0 ? (
            <Body>Not declared.</Body>
          ) : (
            <p className="text-[17px] leading-[1.5] text-charcoal">{listSentence(conditions)}.</p>
          )}
          <Space h={10} />
          <p className="text-[12px] text-grey">{badge}</p>
          <Space h={26} />
          <div className="flex items-center justify-between">
            <h2 className="display text-[20px] text-charcoal">Research</h2>
            {pubs.length > 2 ? (
              <button type="button" onClick={() => setTab("Research")} className="text-[16px] font-semibold text-grey">View all</button>
            ) : null}
          </div>
          <Space h={8} />
          {pubs.length === 0 ? <Body className="text-[16px]">No verified publications yet.</Body> : research(pubs.slice(0, 2))}
        </>
      ) : null}

      {tab === "Research" ? (
        <>
          <h2 className="display text-[20px] text-charcoal">Research</h2>
          <Space h={8} />
          {pubs.length === 0 ? <Body className="text-[16px]">No verified publications yet.</Body> : research(pubs)}
          {pubs.length > 0 ? <p className="pt-3 text-[12px] text-grey">OpenAlex, authorship {pubs[0]!.verification.replace("-", " ")}.</p> : null}
        </>
      ) : null}

      {tab === "Training" ? (
        <>
          <h2 className="display text-[20px] text-charcoal">Training</h2>
          <Space h={8} />
          {training.length === 0 ? (
            <Body className="text-[16px]">Not declared.</Body>
          ) : (
            training.map((t) => (
              <div key={t.title}>
                <SourceRow icon={<FigmaIcon name="file" size={17} />} title={t.title} sub={t.sub} href={t.href} />
                <Divider />
              </div>
            ))
          )}
        </>
      ) : null}

      <Fade />
      <ContactCta doctor={d} label="Contact practice" />
    </Screen>
  );
}
