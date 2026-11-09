// Deployed on Vercel only (no static export, ever). disciplines/*.yaml and data/** are read
// with fs at request time, so they are traced into the serverless bundle.
import { readFileSync } from "node:fs";
// The image optimizer serves the profile hero for these hosts only (data/portrait-hosts.json, written by
// scripts/portrait-hosts.mjs from the roster data); no wildcard, so nobody can spend the plan's transformations on
// other images. Results cards keep the plain <img>; only the one eager hero on /doctor/[id] goes through it.
const portraitHosts = JSON.parse(readFileSync(new URL("./data/portrait-hosts.json", import.meta.url), "utf8"));
/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: portraitHosts.map((hostname) => ({ protocol: "https", hostname })), minimumCacheTTL: 2592000 },
  // The one stylesheet (11 KB gzipped) was the only render-blocking request on every static page; inlined,
  // first paint no longer waits a round trip for it. Client navigations still fetch route CSS as chunks.
  experimental: { inlineCss: true },
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: { "/**": ["./disciplines/**", "./data/providers/**", "./data/enriched/**", "./data/illustrative/**", "./data/discover/**", "./data/geo/**"] },
};

export default nextConfig;
