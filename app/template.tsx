// Re-mounts on every navigation, so each screen eases in (360 ms, ease-out). Reduced motion turns it off.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
