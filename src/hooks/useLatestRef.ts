import { useRef } from "react";

/**
 * Returns a ref whose `.current` is always the latest value of `value`.
 * Use this instead of the three-line pattern:
 *   const xRef = useRef(x);
 *   xRef.current = x;
 */
export function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
