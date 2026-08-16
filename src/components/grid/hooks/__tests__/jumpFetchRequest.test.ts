import { describe, expect, it } from "vitest";
import type { Sort } from "~/shared/grid";
import { buildJumpFetchRequest } from "../jumpFetchRequest";

const sorts: Sort[] = [
  { columnId: "name", direction: "asc", type: "TEXT" },
  { columnId: "amount", direction: "desc", type: "NUMBER" },
];

function row(id: string, rowIndex: number, name: unknown, amount: unknown) {
  return {
    id,
    rowIndex,
    cells: { name, amount },
  };
}

describe("buildJumpFetchRequest", () => {
  it("passes the nearest loaded sorted row as a strict cursor anchor", () => {
    const request = buildJumpFetchRequest({
      tableId: "table-1",
      offset: 500,
      limit: 1000,
      rows: [row("first", 1, "A", 10), row("page-end", 2, "B", 20)],
      jumpCache: new Map([
        [390, row("older-window", 800, "M", 30)],
        [475, row("nearest-window", 900, "N", "42")],
        [500, row("target", 901, "O", 43)],
      ]),
      protectedRowIds: new Set<string>(),
      query: { sorts },
    });

    expect(request).toEqual({
      tableId: "table-1",
      offset: 500,
      limit: 1000,
      filters: undefined,
      conjunction: undefined,
      filterTree: undefined,
      sorts,
      viewId: undefined,
      anchor: {
        anchorOffset: 476,
        cursor: {
          rowIndex: 900,
          sortValues: ["N", 42],
        },
      },
    });
  });

  it("falls back to the last contiguous page row for a first deep jump", () => {
    const request = buildJumpFetchRequest({
      tableId: "table-1",
      offset: 100_000,
      limit: 1000,
      rows: [row("first", 1, "A", 1), row("page-end", 2, "", "not-a-number")],
      jumpCache: new Map(),
      protectedRowIds: new Set(),
      query: { sorts },
    });

    expect(request.anchor).toEqual({
      anchorOffset: 2,
      cursor: {
        rowIndex: 2,
        sortValues: [null, null],
      },
    });
  });

  it("passes a rowIndex anchor for an already-loaded filtered view", () => {
    const args = {
      tableId: "table-1",
      offset: 500,
      limit: 1000,
      rows: [row("first-match", 4, "A", 1)],
      jumpCache: new Map([
        [420, row("older-match", 2104, "B", 2)],
        [475, row("nearest-match", 2379, "C", 3)],
      ]),
      protectedRowIds: new Set<string>(),
      query: {
        filters: [{ columnId: "status", op: "equals" as const, value: "Done" }],
        conjunction: "and" as const,
      },
    };
    const request = buildJumpFetchRequest(args);

    expect(request.anchor).toEqual({
      anchorOffset: 476,
      cursor: { rowIndex: 2379, sortValues: [] },
    });
    expect(
      buildJumpFetchRequest({ ...args, allowAnchor: false }).anchor,
    ).toBeUndefined();
  });

  it("does not anchor from optimistic or unsorted rows", () => {
    const protectedRequest = buildJumpFetchRequest({
      tableId: "table-1",
      offset: 100,
      limit: 1000,
      rows: [row("protected", 1.5, "A", 1)],
      jumpCache: new Map(),
      protectedRowIds: new Set(["protected"]),
      query: { sorts },
    });
    const unsortedRequest = buildJumpFetchRequest({
      tableId: "table-1",
      offset: 100,
      limit: 1000,
      rows: [row("loaded", 1, "A", 1)],
      jumpCache: new Map(),
      protectedRowIds: new Set(),
      query: {},
    });

    expect(protectedRequest.anchor).toBeUndefined();
    expect(unsortedRequest.anchor).toBeUndefined();
  });
});
