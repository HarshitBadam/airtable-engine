"use client";

import { useEffect } from "react";

type RefLike = { current: HTMLElement | null };

interface Options {
  /**
   * If true, attaches the listener after a single tick. Useful when the
   * triggering click is the same one that opened the panel — without the
   * delay the same event would close it instantly.
   */
  delay?: boolean;
  /** Additional refs whose subtree should be treated as inside. */
  ignoreRefs?: RefLike[];
}

/**
 * Closes a popover-style UI when the user clicks outside `ref`.
 * Pass any portal-mounted parts (e.g. dropdown lists) via `ignoreRefs` so
 * clicks inside them don't trigger close.
 */
export function useClickOutside(
  ref: RefLike,
  isOpen: boolean,
  onClose: () => void,
  { delay = false, ignoreRefs = [] }: Options = {},
) {
  useEffect(() => {
    if (!isOpen) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      for (const r of ignoreRefs) {
        if (r.current?.contains(target)) return;
      }
      onClose();
    };

    if (delay) {
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handler);
      }, 10);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handler);
      };
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, delay, ...ignoreRefs.map((r) => r.current)]);
}

export { useEscapeKey } from "./useEscapeKey";
