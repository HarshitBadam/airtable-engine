import type { SqlParam } from "~/server/sql/escape";
import { queryRawUnsafe } from "~/server/sql/queryHelpers";
import type { RowSelect } from "./rowQueryHelpers";

type RawDb = Parameters<typeof queryRawUnsafe>[0];
type EdgeRow = { min_idx: number | null; max_idx: number | null };
type CountBeforeRow = { count: number };
type RowIndexOnly = { rowIndex: number };

function expectedWindowLength(
  rowCount: number,
  offset: number,
  limit: number,
): number {
  return Math.min(limit, Math.max(0, rowCount - offset));
}

async function fetchExactOffset(
  db: RawDb,
  tableId: string,
  offset: number,
  limit: number,
): Promise<RowSelect[]> {
  return queryRawUnsafe<RowSelect[]>(
    db,
    `SELECT "id", "rowIndex", "cells", "createdAt", "updatedAt"
     FROM "Row"
     WHERE "tableId" = $1
     ORDER BY "rowIndex" ASC
     LIMIT $2 OFFSET $3`,
    [tableId, limit, offset],
  );
}

async function fetchFromIndex(
  db: RawDb,
  tableId: string,
  rowIndex: number,
  relativeOffset: number,
  limit: number,
): Promise<RowSelect[]> {
  const params: SqlParam[] = [tableId, rowIndex, limit, relativeOffset];
  return queryRawUnsafe<RowSelect[]>(
    db,
    `SELECT "id", "rowIndex", "cells", "createdAt", "updatedAt"
     FROM "Row"
     WHERE "tableId" = $1 AND "rowIndex" >= $2
     ORDER BY "rowIndex" ASC
     LIMIT $3 OFFSET $4`,
    params,
  );
}

export async function fetchNaturalWindow(
  db: RawDb,
  tableId: string,
  rowCount: number,
  offset: number,
  limit: number,
): Promise<RowSelect[]> {
  const [edges] = await queryRawUnsafe<EdgeRow[]>(
    db,
    `SELECT MIN("rowIndex") AS min_idx, MAX("rowIndex") AS max_idx
     FROM "Row" WHERE "tableId" = $1`,
    [tableId],
  );
  const minIdx = edges?.min_idx;
  const maxIdx = edges?.max_idx;
  if (minIdx == null || maxIdx == null) return [];

  const estimatedRowIndex =
    rowCount <= 1
      ? minIdx
      : minIdx + offset * ((maxIdx - minIdx) / (rowCount - 1));
  const expectedLength = expectedWindowLength(rowCount, offset, limit);
  const estimatedItems = await fetchFromIndex(
    db,
    tableId,
    estimatedRowIndex,
    0,
    limit,
  );

  const isDenseSequence = maxIdx - minIdx === rowCount - 1;
  if (
    isDenseSequence &&
    estimatedItems[0]?.rowIndex === estimatedRowIndex &&
    estimatedItems.length === expectedLength
  ) {
    return estimatedItems;
  }

  const [rankResult] = await queryRawUnsafe<CountBeforeRow[]>(
    db,
    `SELECT COUNT(*)::int AS count
     FROM "Row"
     WHERE "tableId" = $1 AND "rowIndex" < $2`,
    [tableId, estimatedRowIndex],
  );
  const countBefore = rankResult?.count;
  if (countBefore == null) {
    return fetchExactOffset(db, tableId, offset, limit);
  }

  let correctedItems: RowSelect[];
  if (countBefore <= offset) {
    correctedItems = await fetchFromIndex(
      db,
      tableId,
      estimatedRowIndex,
      offset - countBefore,
      limit,
    );
  } else {
    const rowsBack = countBefore - offset - 1;
    const [target] = await queryRawUnsafe<RowIndexOnly[]>(
      db,
      `SELECT "rowIndex"
       FROM "Row"
       WHERE "tableId" = $1 AND "rowIndex" < $2
       ORDER BY "rowIndex" DESC
       LIMIT 1 OFFSET $3`,
      [tableId, estimatedRowIndex, rowsBack],
    );
    if (!target) {
      return fetchExactOffset(db, tableId, offset, limit);
    }
    correctedItems = await fetchFromIndex(
      db,
      tableId,
      target.rowIndex,
      0,
      limit,
    );
  }

  return correctedItems.length === expectedLength
    ? correctedItems
    : fetchExactOffset(db, tableId, offset, limit);
}
