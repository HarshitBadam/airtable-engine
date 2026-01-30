// src/server/api/routers/row.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Params we pass into $queryRawUnsafe.
 * Keep this narrow; Prisma accepts many types, but we only need these.
 */
type SqlParam = string | number | boolean | null | Date;

const filterSchema = z.discriminatedUnion("op", [
  z.object({ columnId: z.string(), op: z.literal("is_empty") }),
  z.object({ columnId: z.string(), op: z.literal("is_not_empty") }),
  z.object({ columnId: z.string(), op: z.literal("contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("not_contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("equals"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("gt"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("lt"), value: z.number() }),
]);

type FilterInput = z.infer<typeof filterSchema>;

const sortSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
  type: z.enum(["TEXT", "NUMBER"]),
});
type SortInput = z.infer<typeof sortSchema>;

const sortedCursorSchema = z.object({
  sortValue: z.union([z.string(), z.number(), z.null()]),
  rowIndex: z.number(),
});
type SortedCursorInput = z.infer<typeof sortedCursorSchema>;

type RowSelect = {
  id: string;
  rowIndex: number;
  cells: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = { count: number };

function buildFilterSql(filters: FilterInput[], params: SqlParam[]): string {
  const clauses: string[] = [];

  for (const f of filters) {
    switch (f.op) {
      case "is_empty": {
        params.push(f.columnId);
        const p = params.length;
        clauses.push(
          `(("Row"."cells" ->> $${p}) IS NULL OR ("Row"."cells" ->> $${p}) = '')`,
        );
        break;
      }
      case "is_not_empty": {
        params.push(f.columnId);
        const p = params.length;
        clauses.push(
          `(("Row"."cells" ->> $${p}) IS NOT NULL AND ("Row"."cells" ->> $${p}) <> '')`,
        );
        break;
      }
      case "contains": {
        params.push(f.columnId);
        const colP = params.length;
        params.push(`%${f.value}%`);
        const valP = params.length;
        clauses.push(`(("Row"."cells" ->> $${colP}) ILIKE $${valP})`);
        break;
      }
      case "not_contains": {
        params.push(f.columnId);
        const colP = params.length;
        params.push(`%${f.value}%`);
        const valP = params.length;
        clauses.push(
          `(("Row"."cells" ->> $${colP}) IS NULL OR ("Row"."cells" ->> $${colP}) NOT ILIKE $${valP})`,
        );
        break;
      }
      case "equals": {
        params.push(f.columnId);
        const colP = params.length;
        params.push(f.value);
        const valP = params.length;
        clauses.push(`(("Row"."cells" ->> $${colP}) = $${valP})`);
        break;
      }
      case "gt":
      case "lt": {
        params.push(f.columnId);
        const colP = params.length;
        params.push(f.value);
        const valP = params.length;
        const op = f.op === "gt" ? ">" : "<";
        clauses.push(
          `(NULLIF(("Row"."cells" ->> $${colP}), '')::double precision ${op} $${valP})`,
        );
        break;
      }
      default: {
        // exhaustive
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustive: never = f;
        break;
      }
    }
  }

  return clauses.length ? ` AND (${clauses.join(" AND ")})` : "";
}

/**
 * Small wrapper to keep call sites clean.
 * Prisma's $queryRawUnsafe returns a PrismaPromise, which is awaitable.
 */
async function queryRawUnsafe<T>(
  db: {
    $queryRawUnsafe: <R = unknown>(query: string, ...values: unknown[]) => PromiseLike<R>;
  },
  sql: string,
  params: SqlParam[],
): Promise<T> {
  return (await db.$queryRawUnsafe<T>(sql, ...params)) as T;
}

/**
 * Sorting helpers (Step 10)
 * We only inject columnId as a literal after validating it belongs to this table.
 */
function escapeLiteral(input: string): string {
  return input.replace(/'/g, "''");
}

function getSortExpr(sort: SortInput): string {
  const colId = escapeLiteral(sort.columnId);

  if (sort.type === "TEXT") {
    return `("Row"."cells" ->> '${colId}')`;
  }
  // NUMBER
  return `(NULLIF(("Row"."cells" ->> '${colId}'), '')::double precision)`;
}

/**
 * Keyset predicate for sorted pagination.
 * Stable tie-breaker is ALWAYS rowIndex ASC.
 *
 * Deterministic NULL ordering:
 * - ASC: NULLs last
 * - DESC: NULLs first
 */
function buildSortedCursorSql(
  sort: SortInput,
  cursor: SortedCursorInput,
  params: SqlParam[],
): string {
  const sortExpr = getSortExpr(sort);
  const nullRankExpr = `(${sortExpr} IS NULL)`;

  const cursorNullRank = cursor.sortValue === null;

  // Always push rowIndex param (used in both branches)
  params.push(cursor.rowIndex);
  const pRowIndex = params.length;

  // Cursor in NULL group: only rowIndex within group; and for DESC allow moving to non-NULL group
  if (cursorNullRank) {
    const nullRankOp = sort.direction === "asc" ? ">" : "<";

    params.push(true);
    const pNullRank = params.length;

    return ` AND (
      (${nullRankExpr} ${nullRankOp} $${pNullRank})
      OR (${nullRankExpr} = $${pNullRank} AND "Row"."rowIndex" > $${pRowIndex})
    )`;
  }

  // Non-null cursor: full tuple comparison
  params.push(false);
  const pNullRank = params.length;

  params.push(cursor.sortValue);
  const pSortVal = params.length;

  const nullRankOp = sort.direction === "asc" ? ">" : "<";
  const sortOp = sort.direction === "asc" ? ">" : "<";

  return ` AND (
    (${nullRankExpr} ${nullRankOp} $${pNullRank})
    OR (${nullRankExpr} = $${pNullRank} AND ${sortExpr} ${sortOp} $${pSortVal})
    OR (${nullRankExpr} = $${pNullRank} AND ${sortExpr} = $${pSortVal} AND "Row"."rowIndex" > $${pRowIndex})
  )`;
}

function normalizeSortValueFromCells(
  sort: SortInput,
  cellsUnknown: unknown,
): string | number | null {
  const cells = (cellsUnknown ?? {}) as Record<string, unknown>;
  const raw = cells[sort.columnId];

  if (raw == null) return null;

  if (sort.type === "NUMBER") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  // TEXT: avoid "[object Object]"
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(500).default(200),

        // cursor:
        // - unsorted: number (rowIndex)
        // - sorted: { sortValue, rowIndex }
        cursor: z.union([z.number(), sortedCursorSchema]).nullable().default(null),

        search: z.string().optional(),
        filters: z.array(filterSchema).optional(),
        sort: sortSchema.nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      const search = input.search?.trim();
      const filters = input.filters ?? [];
      const sort = input.sort ?? null;

      // Validate sort column belongs to this table + type matches DB
      if (sort) {
        const col = await ctx.db.column.findFirst({
          where: { id: sort.columnId, tableId: input.tableId },
          select: { id: true, type: true },
        });
        if (!col) throw new Error("Invalid sort column");
        if (col.type !== sort.type) throw new Error("Sort type mismatch");
      }

      const take = input.limit + 1;

      // Cursor normalization
      const cursor = input.cursor;
      const isSorted = !!sort;

      const cursorRowIndex =
        !isSorted
          ? typeof cursor === "number"
            ? cursor
            : 0
          : typeof cursor === "object" && cursor
            ? cursor.rowIndex
            : 0;

      const sortedCursor =
        isSorted && typeof cursor === "object" && cursor
          ? cursor
          : null;

      // Build WHERE
      const params: SqlParam[] = [];
      params.push(input.tableId);
      let whereSql = `WHERE "Row"."tableId" = $${params.length}`;

      if (search && search.length > 0) {
        params.push(`%${search}%`);
        whereSql += ` AND "Row"."searchText" ILIKE $${params.length}`;
      }

      whereSql += buildFilterSql(filters, params);

      // Cursor predicate
      if (!sort) {
        params.push(cursorRowIndex);
        whereSql += ` AND "Row"."rowIndex" > $${params.length}`;
      } else if (sortedCursor) {
        whereSql += buildSortedCursorSql(sort, sortedCursor, params);
      }

      // ORDER BY
      let orderBySql = `"Row"."rowIndex" ASC`;

      if (sort) {
        const sortExpr = getSortExpr(sort);
        const nullRankOrder = sort.direction === "asc" ? "ASC" : "DESC"; // asc => nulls last; desc => nulls first
        orderBySql = `
          (${sortExpr} IS NULL) ${nullRankOrder},
          ${sortExpr} ${sort.direction.toUpperCase()},
          "Row"."rowIndex" ASC
        `;
      }

      // LIMIT
      params.push(take);
      const limitP = params.length;

      const sql = `
        SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
        FROM "Row"
        ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT $${limitP}
      `;

      const rows = await queryRawUnsafe<RowSelect[]>(ctx.db, sql, params);

      const hasNextPage = rows.length > input.limit;
      const items = hasNextPage ? rows.slice(0, input.limit) : rows;

      let nextCursor:
        | number
        | { sortValue: string | number | null; rowIndex: number }
        | null = null;

      if (hasNextPage && items.length > 0) {
        const last = items[items.length - 1]!;
        if (!sort) {
          nextCursor = last.rowIndex;
        } else {
          nextCursor = {
            sortValue: normalizeSortValueFromCells(sort, last.cells),
            rowIndex: last.rowIndex,
          };
        }
      }

      // COUNT:
      // - if neither search nor filters -> use table.rowCount
      // - else run COUNT with the SAME (search + filters) but WITHOUT cursor predicate
      let totalCount = table.rowCount;

      if ((search && search.length > 0) || filters.length > 0) {
        const countParams: SqlParam[] = [];
        countParams.push(input.tableId);
        let countWhere = `WHERE "Row"."tableId" = $${countParams.length}`;

        if (search && search.length > 0) {
          countParams.push(`%${search}%`);
          countWhere += ` AND "Row"."searchText" ILIKE $${countParams.length}`;
        }

        countWhere += buildFilterSql(filters, countParams);

        const countSql = `SELECT COUNT(*)::int AS count FROM "Row" ${countWhere}`;
        const res = await queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams);
        totalCount = res[0]?.count ?? 0;
      }

      return { items, nextCursor, totalCount };
    }),

  addMany: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(200000).default(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const count = input.count;

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: { increment: count },
            rowCount: { increment: count },
          },
          select: { nextRowIndex: true },
        });

        const startRowIndex = updated.nextRowIndex - count;

        await tx.$executeRaw`
          INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
          SELECT
            ${input.tableId},
            ${startRowIndex} + gs,
            '{}'::jsonb,
            ''::text,
            now(),
            now()
          FROM generate_series(0, ${count} - 1) AS gs;
        `;

        return { startRowIndex, count };
      });
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
        columnId: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true, cells: true },
      });
      if (!row) throw new Error("Row not found");

      const currentCells = (row.cells ?? {}) as Record<string, unknown>;

      if (input.value === null || input.value === "") {
        delete currentCells[input.columnId];
      } else {
        currentCells[input.columnId] = input.value;
      }

      // Lint-safe stringification (avoids "[object Object]")
      const searchText = Object.values(currentCells)
        .map((v) => {
          if (v == null) return "";
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          try {
            return JSON.stringify(v);
          } catch {
            return "";
          }
        })
        .join(" ");

      return ctx.db.row.update({
        where: { id: input.rowId },
        data: {
          cells: currentCells as unknown as object,
          searchText,
        },
        select: { id: true, rowIndex: true, cells: true, updatedAt: true },
      });
    }),
});
