"use client";

import { useEffect } from "react";

/** Calls `onEscape` on every Escape keydown while `isOpen` is true. */
export function useEscapeKey(isOpen: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onEscape]);
}
