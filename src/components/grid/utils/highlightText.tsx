import React from "react";

/** Return non-overlapping [start, end) ranges of `query` in `text` (case-insensitive). */
export function findAllRanges(text: string, query: string): [number, number][] {
  if (!query) return [];
  const ranges: [number, number][] = [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let pos = 0;
  while (pos <= lower.length - qLower.length) {
    const idx = lower.indexOf(qLower, pos);
    if (idx === -1) break;
    ranges.push([idx, idx + qLower.length]);
    pos = idx + qLower.length; // non-overlapping
  }
  return ranges;
}

/** Render `text` with matching substrings highlighted.
 *  All occurrences always get the same yellow (#FFD66B) — matching Airtable's
 *  behaviour where every match is uniformly highlighted regardless of which
 *  occurrence is the current navigation target. */
export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
  /** Kept for API compat but no longer affects highlight colour. */
  currentOccurrenceIndex?: number;
}) {
  const ranges = findAllRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  for (const range of ranges) {
    if (!range) continue;
    const [start, end] = range;
    if (start > lastEnd) parts.push(text.slice(lastEnd, start));
    parts.push(
      <span
        key={start}
        style={{ backgroundColor: "#FFD66B" }}
      >
        {text.slice(start, end)}
      </span>,
    );
    lastEnd = end;
  }
  if (lastEnd < text.length) parts.push(text.slice(lastEnd));
  return <>{parts}</>;
}
