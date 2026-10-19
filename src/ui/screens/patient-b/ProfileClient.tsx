"use client";
// Interactive parts of P06/P11: the bookmark circle (wattle.saved.v1) and the "Contact practice"
// handoff sheet. The sheet shows the practice phone and website as the source listed them; it
// never shows an appointment time.
import { useEffect, useState } from "react";
import type { DoctorRecord } from "@/src/data/types";
import { Check, Circle, Cta, FigmaIcon, Share, Sheet } from "@/src/ui/kit";
import { isSavedId, toggleSavedId } from "@/src/ui/store";
import { contactOf, drShort } from "./facts";

export function BookmarkCircle({ id }: { id: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(isSavedId(id)), [id]);
  return (
    <Circle over label={saved ? "Remove bookmark" : "Bookmark"} onClick={() => setSaved(toggleSavedId(id).includes(id))} className={saved ? "ring-2 ring-white/80" : undefined}>
      <FigmaIcon name="bookmark" size={22} />
    </Circle>
  );
}

export function ContactCta({ doctor, label, note, inline = false }: { doctor: DoctorRecord; label: string; note?: string; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const c = contactOf(doctor);
  const tel = c.phone ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : null;
  return (
    <>
      {inline ? (
        <div className="flex flex-col gap-2">
          {note ? <p className="caption text-center text-[12px] text-grey">{note}</p> : null}
          <Cta fixed={false} onClick={() => setOpen(true)}>{label}</Cta>
        </div>
      ) : (
        <Cta onClick={() => setOpen(true)} note={note}>{label}</Cta>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={`Contact ${drShort(doctor)}`}>
        {c.room ? <p className="text-[14px] text-grey">{c.room}</p> : null}
        {tel ? (
          <a href={tel} className="press flex h-12 items-center justify-center rounded-[6px] bg-ink text-[16px] font-semibold text-white">
            Call {c.phone}
          </a>
        ) : null}
        {c.website ? (
          <a href={c.website} target="_blank" rel="noreferrer" className="press flex h-12 items-center justify-center rounded-[6px] border border-ink bg-white text-[16px] font-semibold text-ink">
            Practice website
          </a>
        ) : null}
        {!tel && !c.website ? <p className="text-[16px] font-medium text-grey">No phone or website listed yet.</p> : null}
      </Sheet>
    </>
  );
}

/** Share the profile URL: the native sheet where it exists, else copy to the clipboard. */
export function ShareCircle({ name, path }: { name: string; path?: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }
    } catch {
      /* dismissed */
    }
  }
  return (
    <Circle label={done ? "Link copied" : "Share"} onClick={() => void share()}>
      {done ? <Check size={18} /> : <Share size={20} />}
    </Circle>
  );
}
