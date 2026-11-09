// Writes data/portrait-hosts.json: every https host that serves a portrait (`photo_url`) in data/**. next.config.mjs
// turns the list into images.remotePatterns, so the image optimizer serves those hosts and nothing else; the
// profile hero (src/ui/screens/patient-a/DoctorCard.tsx Portrait, optimize) only uses it for a listed host.
// Run after adding portraits: `node scripts/portrait-hosts.mjs`; src/data/portrait-hosts.test.ts fails on drift.
import { globSync, readFileSync, writeFileSync } from "node:fs";

export function portraitHosts(root = process.cwd()) {
  const hosts = new Set();
  const walk = (o) => {
    if (Array.isArray(o)) for (const v of o) walk(v);
    else if (o && typeof o === "object") {
      if (typeof o.photo_url === "string" && o.photo_url.startsWith("https://")) hosts.add(new URL(o.photo_url).hostname);
      for (const v of Object.values(o)) walk(v);
    }
  };
  for (const f of globSync("data/**/*.json", { cwd: root })) {
    if (f.replace(/\\/g, "/").endsWith("portrait-hosts.json")) continue;
    try { walk(JSON.parse(readFileSync(`${root}/${f}`, "utf8"))); } catch { /* not a data file */ }
  }
  return [...hosts].sort();
}

if (process.argv[1] && /portrait-hosts\.mjs$/.test(process.argv[1])) {
  const hosts = portraitHosts();
  writeFileSync("data/portrait-hosts.json", JSON.stringify(hosts, null, 2) + "\n");
  console.log(`${hosts.length} portrait hosts`);
}
