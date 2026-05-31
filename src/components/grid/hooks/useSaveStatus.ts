"use client";

import { useState, useEffect, useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";

export type SaveStatus = "idle" | "saving" | "saved";

/**
 * Tracks in-flight tRPC mutations and derives a save status:
 *   - "saving"  → at least one mutation is in-flight (cell edit, row insert, etc.)
 *   - "saved"   → all mutations just settled (shown for 1 second)
 *   - "idle"    → nothing happening
 *
 * Uses React Query's useIsMutating() so no individual mutation instrumentation
 * is needed — every tRPC .mutate() call is automatically tracked.
 */
export function useSaveStatus(): SaveStatus {
  const mutatingCount = useIsMutating();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasMutatingRef = useRef(false);

  useEffect(() => {
    const isMutating = mutatingCount > 0;
    const wasMutating = wasMutatingRef.current;
    wasMutatingRef.current = isMutating;

    if (isMutating) {
      // New mutation started — cancel any pending "saved → idle" timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setStatus("saving");
    } else if (wasMutating) {
      // All mutations just settled → show "All changes saved" for 1s
      setStatus("saved");
      timerRef.current = setTimeout(() => {
        setStatus("idle");
        timerRef.current = null;
      }, 1000);
    }
  }, [mutatingCount]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return status;
}
