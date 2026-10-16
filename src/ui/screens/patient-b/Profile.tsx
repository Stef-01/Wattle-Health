// Doctor profile (v3, 2026-10-16). Order after the Headway / Grow / One Medical benchmark:
// hero facts → the doctor's own words → how they work → outside the clinic → lived experience →
// conditions → research → practical → why this match → where the words came from → call.
// Everything visible comes from the record; long lists fold, prose clamps, nothing is invented.
// Server component; the client bits (bookmark, clamp, disclosures, contact sheet) are small.
import type { DoctorRecord } from "@/src/data/types";
import { asList } from "@/src/data/types";
import { Avatar, Circle, Clamp, Disclosure, FigmaIcon, Labelled, SourceRow } from "@/src/ui/kit";
import { HeroScreen, Space } from "./bits";
import { approachSentence, clip, conditionLabels, hobbySentence, listSentence, drName, drShort, feeOf, hobbyChips, personalOf, placeOf, practicalChips, primaryRoom, pronouns, specialtyTitle, verifiedPublications, wordsSource, yearsLine } from "./facts";
import { BookmarkCircle, ContactCta } from "./ProfileClient";
import { WhyInline } from "./WhyInline";

function Header({ d }: { d: DoctorRecord }) {
  const name = drName(d);
  const room = primaryRoom(d);
  const line = [specialtyTitle(d.specialty), room?.name ?? null].filter(Boolean).join(" · ");
  return (
    <>
      <div className="flex h-11 items-center justify-between">
        <Circle href="/results" label="Back"><FigmaIcon name="arrow-left-22" size={22} /></Circle>
        <BookmarkCircle id={d.id} />
      </div>
      <Space h={24} />
      <div className="flex items-center gap-4">
        <Avatar name={name} size={88} />
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

function Words({ d }: { d: DoctorRecord }) {
  const p = personalOf(d);
  if (!p) return null;
  const pr = pronouns(d);
  const philosophy = p.philosophyOfCare ?? p.philosophy ?? null;
  const why = p.whyMedicine ?? null;
  const approach = approachSentence(d);
  const lived = asList(p.livedExperience)[0] ?? null;
  const outside = hobbySentence(d);
  return (
    <div className="flex flex-col gap-8">
      {philosophy ? (
        <Labelled label={`Meet ${drShort(d)}`}>
          <Clamp text={`“${philosophy}”`} className="font-display text-[20px] leading-[1.35] text-ink" />
        </Labelled>
      ) : null}
      {approach && approach !== philosophy ? (
        <Labelled label={`How ${pr.subject} ${pr.practises}`}>
          <Clamp text={approach} />
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
  if (room) rows.push({ k: "Rooms", v: [room.name, room.address, `${room.suburb} ${room.postcode}`.trim()].filter(Boolean).join(", ") });
  if (rows.length === 0) return null;
  return (
    <Disclosure title="Practical" sub={clip(rows.filter((r) => r.k !== "Rooms").slice(0, 3).map((r) => r.v).join(" · ") || rows[0]!.v, 64)}>
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

function Research({ d }: { d: DoctorRecord }) {
  const pubs = verifiedPublications(d);
  if (pubs.length === 0) return null;
  return (
    <Disclosure title="Research" sub={`${pubs.length} verified ${pubs.length === 1 ? "paper" : "papers"}`}>
      {pubs.slice(0, 5).map((p) => (
        <SourceRow key={p.title} icon={<FigmaIcon name="book" size={17} />} title={clip(p.title, 90)} sub={[p.venue, p.year].filter(Boolean).join(", ") || "Venue not recorded"} href={p.url} />
      ))}
      {pubs.length > 5 ? <p className="pt-2 text-[13px] text-grey">And {pubs.length - 5} more, identifier-matched on OpenAlex.</p> : null}
    </Disclosure>
  );
}

export function Profile({ doctor: d, labels, photo = null }: { doctor: DoctorRecord; labels: Record<string, string>; photo?: string | null }) {
  void photo;
  const personal = personalOf(d);
  const conditions = conditionLabels(d, labels);
  const source = wordsSource(d);
  const pr = pronouns(d);
  const referral = d.referralRequired?.value === true;

  return (
    <HeroScreen padBottom="pb-[150px]">
      <Header d={d} />
      <Space h={20} />
      <Facts d={d} />
      <Space h={28} />
      {personal ? (
        <Words d={d} />
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
      <div className="border-t border-divider">
        <Research d={d} />
        <Practical d={d} />
        <WhyInline doctor={d} />
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
      <ContactCta doctor={d} label="Call to book" note={referral ? "GP referral needed first" : undefined} />
    </HeroScreen>
  );
}
