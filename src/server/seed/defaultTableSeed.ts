import { faker } from "@faker-js/faker";
import type { Prisma } from "../../../generated/prisma";

import { defaultViewConfig } from "~/shared/grid";
import { ensureSortIndex } from "~/server/db/ensureColumnIndexes";

const STATUSES = ["Todo", "In progress", "In review", "Done", "Blocked"] as const;

const DEFAULT_COLUMNS: { name: string; type: "TEXT" | "NUMBER"; order: number }[] = [
  { name: "Name", type: "TEXT", order: 1 },
  { name: "Notes", type: "TEXT", order: 2 },
  { name: "Assignee", type: "TEXT", order: 3 },
  { name: "Status", type: "TEXT", order: 4 },
  { name: "Attachments", type: "TEXT", order: 5 },
];

const DEFAULT_SEED_ROW_COUNT = 25;

type Tx = Prisma.TransactionClient;

export type SeededTable = {
  table: { id: string; name: string };
  columns: { id: string; type: "TEXT" | "NUMBER" }[];
};

/**
 * Caller is responsible for the surrounding transaction so partial seeds
 * never end up persisted.
 */
export async function seedDefaultTable(
  tx: Tx,
  args: {
    baseId?: string;
    tableId?: string;
    tableName?: string;
    seedCount?: number;
  },
): Promise<SeededTable> {
  const seedCount = args.seedCount ?? DEFAULT_SEED_ROW_COUNT;

  const table = args.tableId
    ? await tx.table.findUniqueOrThrow({
        where: { id: args.tableId },
        select: { id: true, name: true },
      })
    : await tx.table.create({
        data: {
          baseId: args.baseId!,
          name: args.tableName ?? "Table 1",
        },
        select: { id: true, name: true },
      });

  const columns = await Promise.all(
    DEFAULT_COLUMNS.map((c) =>
      tx.column.create({
        data: { tableId: table.id, name: c.name, type: c.type, order: c.order },
        select: { id: true, type: true },
      }),
    ),
  );

  await tx.table.update({
    where: { id: table.id },
    data: { nextColumnOrder: DEFAULT_COLUMNS.length + 1 },
  });

  await tx.view.create({
    data: {
      tableId: table.id,
      name: "Grid view",
      config: defaultViewConfig as unknown as object,
    },
  });

  const rowsData = Array.from({ length: seedCount }, (_, i) => {
    const name = faker.person.fullName();
    const notes = faker.company.catchPhrase();
    const assignee = faker.internet.email();
    const status = faker.helpers.arrayElement(STATUSES);
    const attachment = `https://storage.example.com/${faker.string.uuid()}/${faker.system.commonFileName()}`;

    const cells: Record<string, string> = {
      [columns[0]!.id]: name,
      [columns[1]!.id]: notes,
      [columns[2]!.id]: assignee,
      [columns[3]!.id]: status,
      [columns[4]!.id]: attachment,
    };

    const searchText = [name, notes, assignee, status, attachment].join("\u001F");

    return {
      tableId: table.id,
      rowIndex: i + 1,
      cells: cells as unknown as object,
      searchText,
    };
  });

  await tx.row.createMany({ data: rowsData });

  await tx.table.update({
    where: { id: table.id },
    data: { rowCount: seedCount, nextRowIndex: seedCount + 1 },
  });

  return { table, columns: columns as { id: string; type: "TEXT" | "NUMBER" }[] };
}

/**
 * Run *outside* the transaction because index DDL takes its own locks.
 * On a fresh 25-row table this is <50ms total, ensuring the first sort
 * doesn't hit a cold-start index build.
 */
export async function ensureSeedColumnIndexes(
  db: unknown,
  tableId: string,
  columns: { id: string; type: "TEXT" | "NUMBER" }[],
) {
  await Promise.all(
    columns.map((c) => ensureSortIndex(db, tableId, c.id, c.type)),
  );
}
