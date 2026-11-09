import hosts from "@/data/portrait-hosts.json";

/** True when the image optimizer may serve this portrait (its host is in data/portrait-hosts.json → images.remotePatterns). */
export function optimizablePortrait(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return (hosts as string[]).includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
