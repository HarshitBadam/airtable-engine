"use client";
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return d;
}
