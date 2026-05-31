interface ColumnDef {
  id: string;
  sourceColumnId?: string | null;
  defaultValue?: string | null;
}

/**
 * Returns the display value for a cell as a string.
 *
 * Uses `hasOwnProperty` to distinguish between:
 *   - key missing entirely → backfill hasn't written to this row yet
 *     → fall back to sourceColumnId chain / defaultValue
 *   - key present but null → user explicitly cleared the cell
 *     → return "" (respect the user's edit, do NOT fall back)
 *
 * The duplication-chain resolution mirrors server-side logic in
 * column.backfill (capped at 10 hops to prevent infinite loops).
 */
export function getCellValue(
  cells: unknown,
  columnId: string,
  orderedColumns: ColumnDef[],
): string {
  if (!cells || typeof cells !== "object") return "";
  const record = cells as Record<string, unknown>;
  const val = record[columnId];
  if (val !== null && val !== undefined) {
    if (typeof val === "object") return JSON.stringify(val);
    return typeof val === "string" ? val : String(val as number | boolean | bigint | symbol);
  }

  // Key exists but value is null — cell was explicitly written (user edit
  // or backfill set it). Don't fall back to source/default; the user's
  // intent was to clear this cell.
  const hasKey = Object.prototype.hasOwnProperty.call(record, columnId);
  if (hasKey) return "";

  const col = orderedColumns.find((c) => c.id === columnId);

  // Duplication: follow the sourceColumnId chain (handles cascading duplicates,
  // e.g. C duplicated from B duplicated from A).
  // Cap at 10 to match the server-side chain resolution in column.backfill.
  if (col?.sourceColumnId) {
    let srcId: string | null | undefined = col.sourceColumnId;
    for (let depth = 0; depth < 10 && srcId; depth++) {
      const srcVal = record[srcId];
      if (srcVal !== null && srcVal !== undefined) {
        if (typeof srcVal === "object") return JSON.stringify(srcVal);
        return typeof srcVal === "string" ? srcVal : String(srcVal as number | boolean | bigint | symbol);
      }
      // Source cell also empty — follow ITS sourceColumnId if it's
      // also an unbackfilled duplicate.
      const srcCol = orderedColumns.find((c) => c.id === srcId);
      srcId = srcCol?.sourceColumnId;
    }
  }

  if (col?.defaultValue) return col.defaultValue;

  return "";
}
