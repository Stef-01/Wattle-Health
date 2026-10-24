// The request's mode, server side (src/mode.ts says where it comes from). Reading the cookie makes
// the calling page dynamic, which is the point: the same URL serves Wattle or ADHDme.
import { cookies } from "next/headers";
import { defaultMode, MODE_COOKIE, parseMode, type AppMode } from "@/src/mode";
import type { DoctorRecord } from "@/src/data/types";
import { isAdhdSupport } from "@/src/mode";

export async function currentMode(): Promise<AppMode> {
  try {
    return parseMode((await cookies()).get(MODE_COOKIE)?.value) ?? defaultMode();
  } catch {
    // Outside a request (build-time static params): the deployment default.
    return defaultMode();
  }
}

/** The roster a mode serves: everyone, or the ADHD cohort. */
export function scopeRoster(doctors: readonly DoctorRecord[], mode: AppMode): DoctorRecord[] {
  return mode === "adhdme" ? doctors.filter(isAdhdSupport) : doctors.slice();
}
