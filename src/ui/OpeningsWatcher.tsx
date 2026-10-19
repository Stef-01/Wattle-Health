"use client";
// Checks saved doctors' openings when the app opens and every 15 minutes while it stays open.
import { useEffect } from "react";
import { notifyFresh, savedDoctorIds } from "./openings";

export function OpeningsWatcher() {
  useEffect(() => {
    const run = () => {
      if (savedDoctorIds().length) void notifyFresh().catch(() => 0);
    };
    run();
    const t = window.setInterval(run, 15 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  return null;
}
