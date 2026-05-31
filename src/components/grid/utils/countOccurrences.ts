/**
 * Counts non-overlapping, case-insensitive occurrences of `term` in `text`.
 *
 * Stays in lock-step with the server-side substring match counter — both
 * count occurrences (not cells), which is why "X of Y" math lines up.
 */
export function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  const lower = text.toLowerCase();
  const tLower = term.toLowerCase();
  let count = 0;
  let pos = 0;
  while (pos <= lower.length - tLower.length) {
    const idx = lower.indexOf(tLower, pos);
    if (idx === -1) break;
    count++;
    pos = idx + tLower.length;
  }
  return count;
}
