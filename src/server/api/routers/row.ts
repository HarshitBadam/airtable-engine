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
  db: { $queryRawUnsafe: <R = unknown>(query: string, ...values: unknown[]) => PromiseLike<R> },
  sql: string,
  params: SqlParam[],
): Promise<T> {
  return (await db.$queryRawUnsafe<T>(sql, ...params)) as T;
}

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(500).default(200),
        cursor: z.number().nullable().default(null), // last rowIndex
        search: z.string().optional(),
        filters: z.array(filterSchema).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      const cursorRowIndex = input.cursor ?? 0;
      const take = input.limit + 1;
      const search = input.search?.trim();
      const filters = input.filters ?? [];

      const params: SqlParam[] = [input.tableId, cursorRowIndex, take];
      let whereSql = `WHERE "Row"."tableId" = $1 AND "Row"."rowIndex" > $2`;

      if (search && search.length > 0) {
        params.push(`%${search}%`);
        whereSql += ` AND "Row"."searchText" ILIKE $${params.length}`;
      }

      whereSql += buildFilterSql(filters, params);

      const sql = `
        SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
        FROM "Row"
        ${whereSql}
        ORDER BY "Row"."rowIndex" ASC
        LIMIT $3
      `;

      const rows = await queryRawUnsafe<RowSelect[]>(ctx.db, sql, params);

      const hasNextPage = rows.length > input.limit;
      const items = hasNextPage ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasNextPage ? items[items.length - 1]!.rowIndex : null;

      let totalCount = table.rowCount;

      if ((search && search.length > 0) || filters.length > 0) {
        const countParams: SqlParam[] = [input.tableId];
        let countWhere = `WHERE "Row"."tableId" = $1`;

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
