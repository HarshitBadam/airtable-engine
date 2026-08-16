import { describe, expect, it } from "vitest";
import type { Sort } from "~/shared/grid";
import { buildWindowFetchSql } from "../windowFetchSql";

const sorts: Sort[] = [{ columnId: "name", direction: "asc", type: "TEXT" }];

function build(anchor?: {
  anchorOffset: number;
  cursor: { rowIndex: number; sortValues: (string | number | null)[] };
}) {
  return buildWindowFetchSql({
    tableId: "table-1",
    offset: 500,
    limit: 1000,
    search: undefined,
    useTree: undefined,
    filterTree: undefined,
    filters: [],
    conjunction: "and",
    sorts,
    anchor,
  });
}

describe("buildWindowFetchSql", () => {
  it("turns a sorted cursor anchor into a relative offset", () => {
    const result = build({
      anchorOffset: 476,
      cursor: { rowIndex: 900, sortValues: ["N"] },
    });

    expect(result.params.at(-2)).toBe(1000);
    expect(result.params.at(-1)).toBe(24);
    expect(result.sql).toContain(`"Row"."rowIndex" >`);
  });

  it("falls back to the absolute offset for an incompatible anchor", () => {
    const result = build({
      anchorOffset: 476,
      cursor: { rowIndex: 900, sortValues: [] },
    });

    expect(result.params).toEqual(["table-1", 1000, 500]);
  });
});
