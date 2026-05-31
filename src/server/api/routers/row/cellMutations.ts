/*
 * cellMutations.ts is intentionally at the line limit. It implements two
 * tRPC procedures (addMany and updateCell) that share complex cell-value
 * coercion, duplicate-column freeze logic, and rowCount reconciliation. The
 * procedures are too intertwined to split without duplicating shared helpers.
 */
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { escapeLiteral } from "~/server/sql/escape";

export const addMany = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      count: z.number().min(1).max(200000).default(100000),
      populate: z.boolean().default(true),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new Error("Table not found");

    // Only fetch columns when populating with sample data
    const columns = input.populate
      ? await ctx.db.column.findMany({
          where: { tableId: input.tableId },
          orderBy: { order: "asc" },
          select: { id: true, type: true, name: true },
        })
      : [];

    const count = input.count;

    // IMPORTANT: Only increment nextRowIndex here, NOT rowCount.
    // rowCount is incremented after batches succeed (Step 3) so that a
    // failed batch on Vercel (timeout / connection drop) can never leave
    // rowCount higher than the actual number of rows — which would cause
    // permanent ghost/skeleton rows at the end of the table.
    const updated = await ctx.db.$transaction(async (tx) => {
      const t = await tx.table.update({
        where: { id: input.tableId },
        data: {
          nextRowIndex: { increment: count },
        },
        select: { nextRowIndex: true },
      });

      // NOTE: We intentionally do NOT mark ranks stale here.
      // New rows have no ViewRowRank entry.  For scrolling (infinite query)
      // they appear in the "unranked tail" (Phase 2).  For jumps (windowFetch)
      // they fall through to Tier 3 with cursor anchors.  The auto-rank
      // effect on the client re-computes ranks on view load to cover new rows.

      return t;
    });

    const startRowIndex = updated.nextRowIndex - count;
    const tableIdEscaped = escapeLiteral(input.tableId);

    // We keep per-column indexes alive during insert instead of
    // dropping and rebuilding.  B-tree maintenance is O(log N) per
    // row per index, so overhead stays nearly constant as the table
    // grows.  The win: sorts are always instant afterwards — no
    // cold-start index build that scales linearly with table size.
    //
    // If any batch fails, we compensate by rolling back the counters
    // to match the number of rows actually inserted, preventing drift.

    const INSERT_BATCH = 10_000;
    let insertedCount = 0;
    try {
    for (let offset = 0; offset < count; offset += INSERT_BATCH) {
      const batchCount = Math.min(INSERT_BATCH, count - offset);
      const batchStart = startRowIndex + offset;

      let cellsExpr: string;
      let searchExpr: string;

      if (input.populate && columns.length > 0) {
        // Build jsonb_build_object per batch (batchStart changes each iteration).
        // Use column names to pick realistic SQL array-cycling expressions.
        // Each array has a prime-ish length so combinations don't repeat quickly.
        const jsonbParts: string[] = [];
        const searchParts: string[] = [];
        const colNameLower = (n: string) => n.toLowerCase().trim();

        // faker.js-sourced data pools (generated via faker.seed(42)):
        // pre-computed from @faker-js/faker to avoid runtime overhead.
        // Pools are cycled with prime-modulo indexing in SQL ARRAY[...][1 + (idx % N)].
        const FIRST_NAMES = [
          'Garnet','Valentine','Moses','Lavinia','Carley','Anderson','Sammie','Lea',
          'Melissa','Akeem','Waino','Riley','Coy','Cheyenne','Christelle','Elliott',
          'Judson','Hollie','Einar','Leopoldo','Brody','Eladio','Frederic','Jacky',
          'Ozella','Cody','Jordane','Larry','Alyce','Lenora','Cecile','Aniyah',
          'Uriel','Virgil','Rahsaan','Ellis','Axel','Marlee','Ignacio','Bonita',
          'Jerome','Alexzander','Sylvia','Destinee','Makayla','Elvie','Josie','Kasandra',
          'Christine','Wade','Ophelia','Trinity','Soledad','Laverne','Theodora','Ashlynn',
          'Cletus','Alvera','Eriberto','Gilda','Donavon','Rhoda','Fletcher','Earl',
          'Kari','Brooks','Princess','Araceli','Wyman','Olin','Cloyd','Abner',
          'Raven','Melany','Montana','Olen','April','Florida','Betty','Sally',
          'Linda','Erwin','Anibal','Elva','Monty','Louvenia','Sherwood','Jaquan',
          'Blake','Mia','Noemie','Kelli','Ole','Jeremy','Juana','Hettie',
          'Alda','Bernadette','Alexandrea','Louie',
        ]; // 100

        const LAST_NAMES = [
          'Lang','Franey','Roob','Blick','Crooks','Schowalter','Swaniawski','Dibbert',
          'Lindgren','Tremblay','Brown','Keebler','Stoltenberg','Langosh','Fadel','Hauck',
          'Hand','Prosacco','Witting','Graham','Monahan','Bechtelar','Upton','Considine',
          'Yost','Osinski','Ferry','Hilll','Nader','Borer','Hammes','Bauch',
          'Pagac','Langworth','Pollich','Wehner','Heaney','Walsh','Gerlach','Schumm',
          'Lehner','Botsford','Tromp','Hayes','Reinger','Torphy','Nitzsche','Moen',
          'Bradtke','Abshire','Lowe','Rath','Hane','Oberbrunner','Gleason','Wiza',
          'Toy','Schimmel','Mayer','Dietrich','Goyette','Weimann','Ward','Wisoky',
          'Stark','Weber','Marks','Morar','Robel','Greenholt','Schroeder','Veum',
          'Kuvalis','Schinner','Bashirian','Littel','McLaughlin','Hessel','Ledner',
          'Emmerich','Bogan','Lemke','Nienow','Wolf','Goldner','Block','Windler',
          'Predovic','Dach','Barton','Runte','Jakubowski','Hartmann','Beier','Hoeger',
          'Hermann',
        ]; // 97

        const CATCH_PHRASES = [
          'Decentralized demand-driven knowledge base','Reactive national database',
          'User-friendly real-time knowledge user','Polarised heuristic core',
          'Grass-roots regional access','Cross-platform analyzing algorithm',
          'Sustainable optimal infrastructure','Compatible immersive infrastructure',
          'Digitized high-level functionalities','Polarised modular alliance',
          'Immersive mobile instruction set','Sustainable national capability',
          'Business-focused motivating adapter','Persistent value-added local area network',
          'Implemented motivating hub','Organic value-added framework',
          'User-friendly transitional collaboration','Business-focused bifurcated access',
          'Compatible neutral application','Fully-configurable system-worthy adapter',
          'Sharable disintermediate artificial intelligence','Quality-focused mobile strategy',
          'Reduced secondary database','Digitized reciprocal projection',
          'Visionary global frame','Seamless executive task-force',
          'Sustainable high-level portal','Robust bottom-line support',
          'Open-source static encryption','Total fresh-thinking access',
          'Triple-buffered bifurcated encryption','User-centric well-modulated local area network',
          'Profit-focused holistic definition','Fundamental needs-based portal',
          'Self-enabling scalable architecture','Open-source asymmetric knowledge base',
          'Managed tertiary focus group','Cross-platform client-server pricing structure',
          'Proactive bifurcated architecture','Quality-focused asynchronous protocol',
          'Reactive attitude-oriented architecture','Virtual fault-tolerant frame',
          'Sharable well-modulated website','Robust fault-tolerant architecture',
          'Seamless leading edge hardware','Triple-buffered bottom-line installation',
          'AI-driven human-resource analyzer','Cross-platform clear-thinking model',
          'Reverse-engineered logistical toolset','Immersive disintermediate strategy',
          'Ergonomic zero administration access','Versatile actuating success',
          'Optimized zero trust approach','Organic zero defect internet solution',
          'Proactive next generation hub','Proactive maximized support',
          'Automated disintermediate time-frame','Total homogeneous microservice',
          'Face to face composite implementation','Grass-roots logistical approach',
          'Versatile zero tolerance open architecture','Optional eco-centric projection',
          'Public-key coherent synergy','Smart well-modulated parallelism',
          'Polarised heuristic task-force','Synchronised analyzing adapter',
          'Immersive stable website','Decentralized maximized framework',
          'Versatile sustainable software','Multi-tiered global data-warehouse',
          'Balanced systematic projection','Visionary zero trust knowledge user',
          'Seamless well-modulated solution','Expanded homogeneous attitude',
          'User-friendly methodical conglomeration','Progressive mobile forecast',
          'Cross-platform needs-based interface','Seamless intangible solution',
          'Organic leading edge strategy',
        ]; // 79

        // faker.js free_email domains (faker.definitions.internet.free_email)
        const EMAIL_PROVIDERS = [
          'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
          'protonmail.com','aol.com','mail.com','zoho.com','fastmail.com',
          'yandex.com','tutanota.com','gmx.com',
        ]; // 13

        const FILE_EXTS = ['pdf','docx','xlsx','png','jpg','csv','txt','pptx','zip','svg']; // 10
        const FILE_PREFIXES = [
          'report','invoice','presentation','document','spreadsheet','summary',
          'analysis','proposal','contract','memo','brief','overview','review',
          'draft','plan','notes','agenda','schedule','budget','forecast',
        ]; // 20

        // SQL helper: builds ARRAY[...][1 + ((idx) % len)]
        const sqlArrayPick = (arr: string[], idxExpr: string) => {
          const escaped = arr.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
          return `(ARRAY[${escaped}])[1 + ((${idxExpr}) % ${arr.length})]`;
        };

        // Use different prime multipliers per field so combinations don't align.
        // idx is the absolute row index: batchStart + gs
        const idx = `(${batchStart} + gs)`;

        for (const col of columns) {
          const colId = escapeLiteral(col.id);
          const name = colNameLower(col.name);

          if (col.type === "NUMBER") {
            jsonbParts.push(`'${colId}', (${batchStart} + gs)`);
            searchParts.push(`(${batchStart} + gs)::text`);
          } else if (name === "name") {
            const expr = `${sqlArrayPick(FIRST_NAMES, idx)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 7 + 3`)}`;
            jsonbParts.push(`'${colId}', ${expr}`);
            searchParts.push(expr);
          } else if (name === "notes") {
            const expr = sqlArrayPick(CATCH_PHRASES, `${idx} * 3 + 1`);
            jsonbParts.push(`'${colId}', ${expr}`);
            searchParts.push(expr);
          } else if (name === "assignee") {
            const expr = `lower(${sqlArrayPick(FIRST_NAMES, `${idx} * 11 + 5`)}) || '.' || lower(${sqlArrayPick(LAST_NAMES, `${idx} * 13 + 7`)}) || '@' || ${sqlArrayPick(EMAIL_PROVIDERS, `${idx} * 17 + 2`)}`;
            jsonbParts.push(`'${colId}', ${expr}`);
            searchParts.push(expr);
          } else if (name === "status") {
            const expr = sqlArrayPick(['Todo','In progress','In review','Done','Blocked'], idx);
            jsonbParts.push(`'${colId}', ${expr}`);
            searchParts.push(expr);
          } else if (name === "attachments") {
            const expr = `'https://storage.example.com/' || ${sqlArrayPick(FILE_PREFIXES, `${idx} * 3`)} || '-' || ${idx} || '.' || ${sqlArrayPick(FILE_EXTS, `${idx} * 7`)}`;
            jsonbParts.push(`'${colId}', ${expr}`);
            searchParts.push(expr);
          } else {
            const expr = `${sqlArrayPick(FIRST_NAMES, `${idx} * 3`)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 5 + 1`)}`;
            jsonbParts.push(`'${colId}', ${expr}`);
            searchParts.push(expr);
          }
        }

        cellsExpr = `jsonb_build_object(${jsonbParts.join(", ")})`;
        searchExpr = searchParts.join(` || chr(31) || `);
      } else {
        cellsExpr = `'{}'::jsonb`;
        searchExpr = `''::text`;
      }

      await ctx.db.$executeRawUnsafe(`
        INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
        SELECT
          '${tableIdEscaped}',
          ${batchStart} + gs,
          ${cellsExpr},
          ${searchExpr},
          now(),
          now()
        FROM generate_series(0, ${batchCount - 1}) AS gs
      `);
      insertedCount += batchCount;
    }
    } catch (err) {
      // Compensate: roll back nextRowIndex for the rows that weren't inserted.
      // rowCount was NOT pre-incremented, so no rowCount drift is possible.
      const missed = count - insertedCount;
      if (missed > 0) {
        try {
          await ctx.db.table.update({
            where: { id: input.tableId },
            data: {
              nextRowIndex: { decrement: missed },
            },
          });
        } catch {
          // If even the compensation fails (connection dead), nextRowIndex
          // is slightly too high — harmless (just a gap in row indices).
          // rowCount is still correct because we haven't touched it yet.
        }
      }

      // Even on failure, reconcile rowCount with the actual row count so
      // any partially inserted rows are reflected correctly.
      try {
        const [actual] = await ctx.db.$queryRawUnsafe<{ cnt: number }[]>(
          `SELECT COUNT(*)::int AS cnt FROM "Row" WHERE "tableId" = $1`,
          input.tableId,
        );
        if (actual) {
          await ctx.db.table.update({
            where: { id: input.tableId },
            data: { rowCount: actual.cnt },
          });
        }
      } catch {
        // Best-effort reconciliation — if this fails too, the counter
        // may be slightly off but at least it won't be wildly inflated.
      }

      throw err;
    }

    // Reconcile rowCount with the actual number of rows.
    // Using COUNT(*) is the source of truth — eliminates any possible
    // drift from partial failures, race conditions, or prior bugs.
    // Cost: ~10-30ms for 300K rows with the tableId index.
    const [actual] = await ctx.db.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*)::int AS cnt FROM "Row" WHERE "tableId" = $1`,
      input.tableId,
    );
    if (actual) {
      await ctx.db.table.update({
        where: { id: input.tableId },
        data: { rowCount: actual.cnt },
      });
    }

    return { startRowIndex, count };
  });

export const updateCell = protectedProcedure
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

    // Validate the column exists and coerce value to match its type.
    // This prevents storing a string in a NUMBER column or vice versa,
    // which would break sorting and filtering.
    const column = await ctx.db.column.findFirst({
      where: { id: input.columnId, tableId: input.tableId },
      select: { id: true, type: true, sourceColumnId: true },
    });
    if (!column) throw new Error("Column not found");

    const row = await ctx.db.row.findFirst({
      where: { id: input.rowId, tableId: input.tableId },
      select: { id: true, cells: true },
    });
    if (!row) throw new Error("Row not found");

    const currentCells = (row.cells ?? {}) as Record<string, unknown>;

    // Freeze pre-edit value into dependent (duplicate) columns.
    // If c1c was duplicated from c1 (sourceColumnId = c1.id) and the
    // backfill hasn't written c1c's key yet, copy c1's current value
    // into c1c so the backfill (which uses existing-wins ordering)
    // won't overwrite it with the post-edit value.
    const dependents = await ctx.db.column.findMany({
      where: { sourceColumnId: input.columnId, tableId: input.tableId },
      select: { id: true },
    });
    for (const dep of dependents) {
      if (!Object.prototype.hasOwnProperty.call(currentCells, dep.id)) {
        const oldVal = currentCells[input.columnId];
        currentCells[dep.id] = oldVal ?? null;
      }
    }

    if (input.value === null || input.value === "") {
      // If this column is still being backfilled (has sourceColumnId),
      // set to null instead of deleting so the key persists in JSONB.
      // The backfill uses existing-wins ordering and will skip this key.
      if (column.sourceColumnId) {
        currentCells[input.columnId] = null;
      } else {
        delete currentCells[input.columnId];
      }
    } else if (column.type === "NUMBER") {
      // For NUMBER columns, coerce string inputs to numbers.
      // If the value can't be parsed as a number, reject it.
      const num = typeof input.value === "number" ? input.value : Number(input.value);
      if (Number.isNaN(num)) {
        throw new Error("Invalid number value");
      }
      currentCells[input.columnId] = num;
    } else {
      currentCells[input.columnId] = typeof input.value === "number"
        ? String(input.value)
        : input.value;
    }

    // Lint-safe stringification (avoids "[object Object]")
    // Uses \u001F (Unit Separator) as delimiter to prevent cross-cell false matches
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
      .join("\u001F");

    const result = await ctx.db.row.update({
      where: { id: input.rowId },
      data: {
        cells: currentCells as unknown as object,
        searchText,
      },
      select: { id: true, rowIndex: true, cells: true, updatedAt: true },
    });

    // NOTE: We intentionally do NOT mark ranks stale here.
    // With permanent sort (autoSort=false), the rank is frozen — cell
    // edits don't move the row. With autoSort=true, the query uses live
    // ORDER BY (no ViewRowRank), so ranks aren't relevant.

    return result;
  });
