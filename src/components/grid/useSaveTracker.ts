"use client";

import { useState, useEffect, useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";

export type SaveStatus = "idle" | "saving" | "saved";

// Tracks in-flight mutations and shows save status (saving → saved → idle)
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
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setStatus("saving");
    } else if (wasMutating) {
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
