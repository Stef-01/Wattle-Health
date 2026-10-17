// Doctor profile (v3, 2026-10-16). Order after the Headway / Grow / One Medical benchmark:
// hero facts → the doctor's own words → how they work → outside the clinic → lived experience →
// conditions → research → practical → why this match → where the words came from → call.
// Everything visible comes from the record; long lists fold, prose clamps, nothing is invented.
// Server component; the client bits (bookmark, clamp, disclosures, contact sheet) are small.
import type { DoctorRecord } from "@/src/data/types";
import { asList } from "@/src/data/types";
import { Avatar, Circle, Clamp, Disclosure, FigmaIcon, Labelled, SourceRow } from "@/src/ui/kit";
import { HeroScreen, Space } from "./bits";
import { approachSentence, clip, conditionLabels, hobbySentence, listSentence, niceSource, TIER_WORD, drName, drShort, feeOf, hobbyChips, personalOf, placeOf, practicalChips, primaryRoom, pronouns, specialtyTitle, verifiedPublications, wordsSource, yearsLine } from "./facts";
import { BookmarkCircle, ContactCta, ShareCircle } from "./ProfileClient";
import { WhyInline } from "./WhyInline";

function Header({ d }: { d: DoctorRecord }) {
  const name = drName(d);
  const room = primaryRoom(d);
  const line = [specialtyTitle(d.specialty), room?.name ?? null].filter(Boolean).join(" · ");
  return (
    <>
      <div className="flex h-11 items-center justify-between">
        <Circle href="/results" label="Back"><FigmaIcon name="arrow-left-22" size={22} /></Circle>
        <span className="flex gap-2">
          <ShareCircle name={name} />
          <BookmarkCircle id={d.id} />
        </span>
      </div>
      <Space h={24} />
      <div className="flex items-center gap-4">
        {d.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.photo.url} alt={d.photo.alt ?? name} referrerPolicy="no-referrer" className="settle size-[88px] shrink-0 rounded-full object-cover object-top" style={{ background: "#e9e9e9" }} />
        ) : (
          <Avatar name={name} size={88} />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="display text-[30px] leading-[1.1] tracking-[-0.01em] text-ink">{name}{d.synthetic ? " (example)" : ""}</h1>
          <p className="text-[14px] leading-snug text-grey">{line}</p>
          <p className="text-[14px] text-grey">{placeOf(d)}</p>
        </div>
      </div>
    </>
  );
}

function Facts({ d }: { d: DoctorRecord }) {
  const facts = [yearsLine(d), ...practicalChips(d)].filter(Boolean) as string[];
  if (facts.length === 0) return null;
  return <p className="text-[14px] leading-[1.5] text-grey">{facts.join(" · ")}</p>;
}

/** True when two passages share most of their words (a paraphrase of the same line). */
function similar(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const words = (t: string) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(1, Math.min(wa.size, wb.size)) > 0.5;
}

function Words({ d }: { d: DoctorRecord }) {
  const p = personalOf(d);
  if (!p) return null;
  const pr = pronouns(d);
  const philosophy = p.philosophyOfCare ?? p.philosophy ?? null;
  const why = p.whyMedicine ?? null;
  const approach = approachSentence(d);
  const lived = asList(p.livedExperience)[0] ?? null;
  const outside = hobbySentence(d);
  const ABOUT: Record<string, string> = { why: "Why medicine", approach: "How they work", lived: "Lived experience", hobbies: "Outside the clinic", other: "Also from their page" };
  const rest = (p.quotes ?? []).filter((q) => !similar(q.text, philosophy) && !similar(q.text, approach));
  const more = rest.length ? rest.map((q, i) => (
    <p key={i} className="text-[16px] leading-[1.5] text-charcoal">
      <span className="text-grey">{ABOUT[q.about] ?? "From their page"} · </span>“{q.text}”
    </p>
  )) : undefined;
  const purpose = p.professionalPurpose ?? p.purpose ?? null;
  return (
    <div className="flex flex-col gap-8">
      {philosophy ? (
        <Labelled label={`Meet ${drShort(d)}`}>
          <Clamp text={`“${philosophy}”`} className="font-display text-[20px] leading-[1.35] text-ink" more={more} />
        </Labelled>
      ) : null}
      {approach && !similar(approach, philosophy) ? (
        <Labelled label={`How ${pr.subject} ${pr.practises}`}>
          <Clamp text={approach} more={purpose ? <p className="text-[16px] leading-[1.5] text-charcoal">{purpose}</p> : undefined} />
        </Labelled>
      ) : null}
      {why ? (
        <Labelled label="Why medicine">
          <Clamp text={why} />
        </Labelled>
      ) : null}
      {outside ? (
        <Labelled label="Outside the clinic">
          <Clamp text={outside} lines={4} />
        </Labelled>
      ) : null}
      {lived ? (
        <Labelled label="Lived experience">
          <p className="text-[17px] leading-[1.5] text-charcoal">{clip(lived, 220)}</p>
        </Labelled>
      ) : null}
    </div>
  );
}

function Practical({ d }: { d: DoctorRecord }) {
  const room = primaryRoom(d);
  const fee = feeOf(d);
  const rows: { k: string; v: string }[] = [];
  if (fee) rows.push({ k: "First visit", v: fee });
  if (d.declared.telehealth) rows.push({ k: "Telehealth", v: d.telehealth.value === "none" ? "In person only" : d.telehealth.value === "only" ? "Telehealth only" : d.telehealth.value === "first-appointment" ? "First visit by video" : "Available" });
  if (d.referralRequired) rows.push({ k: "Referral", v: d.referralRequired.value ? "GP referral needed" : "Not needed" });
  if (d.waitTimeText) rows.push({ k: "Wait", v: d.waitTimeText });
  if (d.languages?.value.length) rows.push({ k: "Languages", v: d.languages.value.join(", ") });
  if (room) rows.push({ k: "Rooms", v: Array.from(new Set([room.name, room.address, `${room.suburb} ${room.postcode}`.trim()].filter((x): x is string => Boolean(x)))).join(", ") });
  if (rows.length === 0) return null;
  return (
    <Disclosure tint="practical" title="Practical" sub={clip(rows.filter((r) => r.k !== "Rooms").slice(0, 3).map((r) => r.v).join(" · ") || rows[0]!.v, 64)}>
      <dl className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.k} className="flex gap-4 text-[15px]">
            <dt className="w-24 shrink-0 text-grey">{r.k}</dt>
            <dd className="text-charcoal">{r.v}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}

function Sources({ d }: { d: DoctorRecord }) {
  const rows = d.sources.filter((s) => s.sourceUrl);
  if (rows.length === 0) return null;
  return (
    <Disclosure tint="sources" title="Where this comes from" sub={`${rows.length} ${rows.length === 1 ? "source" : "sources"}, each dated`}>
      {rows.map((s) => (
        <SourceRow key={`${s.source}-${s.sourceUrl}`} icon={<FigmaIcon name="file" size={17} />} title={niceSource(s.source)} sub={`${TIER_WORD.found}, ${s.observedAt.slice(0, 10)}`} href={s.sourceUrl} />
      ))}
    </Disclosure>
  );
}

function Research({ d }: { d: DoctorRecord }) {
  const pubs = verifiedPublications(d);
  if (pubs.length === 0) return null;
  return (
    <Disclosure tint="research" title="Research" sub={`${pubs.length} verified ${pubs.length === 1 ? "paper" : "papers"}`}>
      {pubs.slice(0, 5).map((p) => (
        <SourceRow key={p.title} icon={<FigmaIcon name="book" size={17} />} title={clip(p.title, 90)} sub={[p.venue, p.year].filter(Boolean).join(", ") || "Venue not recorded"} href={p.url} />
      ))}
      {pubs.length > 5 ? <p className="pt-2 text-[13px] text-grey">And {pubs.length - 5} more, identifier-matched on OpenAlex.</p> : null}
    </Disclosure>
  );
}

/** Everything below the header: facts, their words, what they see, the folded panels, the source line. */
export function ProfileBody({ doctor: d, labels }: { doctor: DoctorRecord; labels: Record<string, string> }) {
  const personal = personalOf(d);
  const conditions = conditionLabels(d, labels);
  const source = wordsSource(d);
  const pr = pronouns(d);
  return (
    <>
      <Facts d={d} />
      <Space h={28} />
      {personal ? (
        <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <Words d={d} />
        </div>
      ) : (
        <p className="text-[16px] leading-[1.5] text-grey">
          {pr.hasnt} shared how {pr.subject} {pr.practises} yet. What is here comes from the public listing.
        </p>
      )}
      <Space h={28} />
      <Labelled label="Sees">
        <p className="text-[17px] leading-[1.5] text-charcoal">{conditions.length ? `${listSentence(conditions)}.` : "No clinical focus listed yet."}</p>
      </Labelled>
      <Space h={16} />
      <div className="rise flex flex-col" style={{ "--i": 5 } as React.CSSProperties}>
        <Research d={d} />
        <Practical d={d} />
        <WhyInline doctor={d} />
        <Sources d={d} />
      </div>
      <Space h={20} />
      {source ? (
        <p className="caption text-[12px] leading-normal text-grey">
          {source.text}
          {source.href ? (
            <>
              {" "}
              <a href={source.href} target="_blank" rel="noreferrer" className="text-accent">Source</a>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

export function Profile({ doctor: d, labels, photo = null }: { doctor: DoctorRecord; labels: Record<string, string>; photo?: string | null }) {
  void photo;
  const referral = d.referralRequired?.value === true;
  return (
    <HeroScreen padBottom="pb-[150px]">
      <Header d={d} />
      <Space h={20} />
      <ProfileBody doctor={d} labels={labels} />
      <ContactCta doctor={d} label="Call to book" note={referral ? "GP referral needed first" : undefined} />
    </HeroScreen>
  );
}
