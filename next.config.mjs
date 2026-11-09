// Deployed on Vercel only (no static export, ever). disciplines/*.yaml and data/** are read
// with fs at request time, so they are traced into the serverless bundle.
/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The one stylesheet (11 KB gzipped) was the only render-blocking request on every static page; inlined,
  // first paint no longer waits a round trip for it. Client navigations still fetch route CSS as chunks.
  experimental: { inlineCss: true },
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: { "/**": ["./disciplines/**", "./data/providers/**", "./data/enriched/**", "./data/illustrative/**", "./data/discover/**", "./data/geo/**"] },
};

export default nextConfig;
