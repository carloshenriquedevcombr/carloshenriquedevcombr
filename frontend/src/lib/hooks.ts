"use client";

import { useSyncExternalStore } from "react";

/** Media query reativa; no servidor (e na hidratação) sempre false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useWideScreen = () => useMediaQuery("(min-width: 768px)");
