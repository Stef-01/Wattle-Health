"use client";
import { useEffect, useState } from "react";

/**
 * One query parameter, read after mount. `useSearchParams` in a statically prerendered page makes Next
 * bail the whole subtree out to client rendering (the join screens shipped no <main> at all, first paint
 * 3.6 s on 4G, 2026-11-08). Screens that only need the value inside an effect or a link read it here
 * instead; the server HTML carries the complete screen and the value arrives with hydration.
 */
export function useQueryParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}
