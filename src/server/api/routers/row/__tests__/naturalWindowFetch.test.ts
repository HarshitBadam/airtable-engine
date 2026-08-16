import { describe, expect, it } from "vitest";
import { fetchNaturalWindow } from "../naturalWindowFetch";

function createDb(rowIndexes: number[]) {
  const rows = rowIndexes.map((rowIndex) => ({
    id: `row-${rowIndex}`,
    rowIndex,
    cells: {},
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
  const queries: string[] = [];

  const db = {
    $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
      queries.push(sql);

      if (sql.includes('MIN("rowIndex")')) {
        return [
          {
            min_idx: rows[0]?.rowIndex ?? null,
            max_idx: rows.at(-1)?.rowIndex ?? null,
          },
        ];
      }

      if (sql.includes("COUNT(*)::int")) {
        const estimate = params[1] as number;
        return [
          { count: rows.filter((item) => item.rowIndex < estimate).length },
        ];
      }

      if (sql.includes('ORDER BY "rowIndex" DESC')) {
        const estimate = params[1] as number;
        const offset = params[2] as number;
        return [...rows]
          .filter((item) => item.rowIndex < estimate)
          .reverse()
          .slice(offset, offset + 1)
          .map(({ rowIndex }) => ({ rowIndex }));
      }

      const limit = params[2] as number;
      const offset = sql.includes('AND "rowIndex" >= $2')
        ? (params[3] as number)
        : (params[2] as number);
      const candidates = sql.includes('AND "rowIndex" >= $2')
        ? rows.filter((item) => item.rowIndex >= (params[1] as number))
        : rows;
      const actualLimit = sql.includes('AND "rowIndex" >= $2')
        ? limit
        : (params[1] as number);
      return candidates.slice(offset, offset + actualLimit);
    },
  };

  return { db, queries };
}

describe("fetchNaturalWindow", () => {
  it("corrects an estimate that lands after the requested uneven position", async () => {
    const { db } = createDb([1, 1.5, 2, 3, 4]);

    const items = await fetchNaturalWindow(db as never, "table-1", 5, 2, 2);

    expect(items.map((item) => item.rowIndex)).toEqual([2, 3]);
  });

  it("corrects an estimate that lands before the requested uneven position", async () => {
    const { db } = createDb([1, 2.5, 3, 3.5, 4]);

    const items = await fetchNaturalWindow(db as never, "table-1", 5, 2, 2);

    expect(items.map((item) => item.rowIndex)).toEqual([3, 3.5]);
  });

  it("keeps the two-query fast path for a dense sequence", async () => {
    const { db, queries } = createDb([10, 11, 12, 13, 14]);

    const items = await fetchNaturalWindow(db as never, "table-1", 5, 2, 2);

    expect(items.map((item) => item.rowIndex)).toEqual([12, 13]);
    expect(queries).toHaveLength(2);
    expect(queries.some((sql) => sql.includes("COUNT(*)"))).toBe(false);
  });
});
