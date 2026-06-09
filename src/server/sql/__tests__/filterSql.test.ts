import { describe, it, expect, beforeEach } from "vitest";
import type { Filter } from "~/shared/grid";
import { buildFilterSql, buildFilterTreeSql } from "../filterSql";
import type { FilterTree } from "~/shared/grid";
import type { SqlParam } from "../escape";

describe("buildFilterSql", () => {
  let params: SqlParam[];

  beforeEach(() => {
    params = [];
  });

  it("returns empty string for an empty filter array", () => {
    expect(buildFilterSql([], params)).toBe("");
    expect(params).toHaveLength(0);
  });

  it("wraps result in a leading AND clause", () => {
    const filter: Filter = { columnId: "col1", op: "is_empty" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toMatch(/^ AND /);
  });

  it("generates IS NULL for is_empty filter", () => {
    const filter: Filter = { columnId: "col1", op: "is_empty" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("IS NULL");
    expect(sql).toContain("'col1'");
    expect(params).toHaveLength(0);
  });

  it("generates IS NOT NULL for is_not_empty filter", () => {
    const filter: Filter = { columnId: "col1", op: "is_not_empty" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("IS NOT NULL");
    expect(params).toHaveLength(0);
  });

  it("generates ILIKE with wrapped wildcard for contains filter", () => {
    const filter: Filter = { columnId: "col1", op: "contains", value: "hello" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("ILIKE");
    expect(sql).toContain("$1");
    expect(params).toEqual(["%hello%"]);
  });

  it("escapes % in contains filter value", () => {
    const filter: Filter = { columnId: "col1", op: "contains", value: "50%" };
    buildFilterSql([filter], params);
    expect(params[0]).toBe("%50\\%%");
  });

  it("escapes _ in contains filter value", () => {
    const filter: Filter = { columnId: "col1", op: "contains", value: "my_field" };
    buildFilterSql([filter], params);
    expect(params[0]).toBe("%my\\_field%");
  });

  it("generates NOT ILIKE for not_contains filter", () => {
    const filter: Filter = { columnId: "col1", op: "not_contains", value: "world" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("NOT ILIKE");
    // Also includes IS NULL guard so empty cells are treated as non-matching
    expect(sql).toContain("IS NULL");
    expect(params).toEqual(["%world%"]);
  });

  it("generates = clause for equals filter (TEXT)", () => {
    const filter: Filter = { columnId: "col1", op: "equals", value: "exact" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("= $1");
    expect(params).toEqual(["exact"]);
  });

  it("generates <> clause for not_equals filter", () => {
    const filter: Filter = { columnId: "col1", op: "not_equals", value: "other" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("<> $1");
    // IS NULL guard ensures rows with no value pass the "not equal" check
    expect(sql).toContain("IS NULL");
    expect(params).toEqual(["other"]);
  });

  it("generates > with double precision cast for gt filter", () => {
    const filter: Filter = { columnId: "col1", op: "gt", value: 42 };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("> $1");
    expect(sql).toContain("double precision");
    expect(params).toEqual([42]);
  });

  it("generates < for lt filter", () => {
    const filter: Filter = { columnId: "col1", op: "lt", value: 10 };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("< $1");
    expect(params).toEqual([10]);
  });

  it("generates >= for gte filter", () => {
    const filter: Filter = { columnId: "col1", op: "gte", value: 5 };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain(">= $1");
    expect(params).toEqual([5]);
  });

  it("generates <= for lte filter", () => {
    const filter: Filter = { columnId: "col1", op: "lte", value: 100 };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("<= $1");
    expect(params).toEqual([100]);
  });

  it("wraps column reference in NULLIF to treat empty strings as NULL", () => {
    const filter: Filter = { columnId: "mycol", op: "is_empty" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("NULLIF");
    expect(sql).toContain('"Row"."cells"');
    expect(sql).toContain("'mycol'");
  });

  it("ANDs multiple filters together by default", () => {
    const filters: Filter[] = [
      { columnId: "col1", op: "is_not_empty" },
      { columnId: "col2", op: "is_empty" },
    ];
    const sql = buildFilterSql(filters, params);
    expect(sql).toContain(" AND ");
    expect(sql).toContain("'col1'");
    expect(sql).toContain("'col2'");
  });

  it("ORs multiple filters when conjunction is 'or'", () => {
    const filters: Filter[] = [
      { columnId: "col1", op: "equals", value: "a" },
      { columnId: "col1", op: "equals", value: "b" },
    ];
    const sql = buildFilterSql(filters, params, "or");
    expect(sql).toContain(" OR ");
    expect(params).toEqual(["a", "b"]);
  });

  it("assigns sequential param indices across multiple filters", () => {
    const filters: Filter[] = [
      { columnId: "col1", op: "contains", value: "foo" },
      { columnId: "col2", op: "contains", value: "bar" },
    ];
    const sql = buildFilterSql(filters, params);
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
    expect(params).toEqual(["%foo%", "%bar%"]);
  });

  it("appends to a pre-populated params array and uses correct indices", () => {
    // Simulates a caller that already has params from an earlier query part
    params.push("existing");  // $1 is taken
    const filter: Filter = { columnId: "col1", op: "equals", value: "new" };
    const sql = buildFilterSql([filter], params);
    expect(sql).toContain("= $2");
    expect(params).toEqual(["existing", "new"]);
  });

  it("rejects column IDs containing characters outside the safe identifier set", () => {
    // Defense-in-depth: real column IDs are server-generated cuids/uuids. Any ID
    // with a quote (or other injection character) is rejected outright by
    // assertSafeId rather than merely escaped.
    const filter: Filter = { columnId: "col'1", op: "is_empty" };
    expect(() => buildFilterSql([filter], params)).toThrow(
      /Unsafe SQL identifier rejected/,
    );
  });
});

describe("buildFilterTreeSql", () => {
  let params: SqlParam[];

  beforeEach(() => {
    params = [];
  });

  it("returns empty string for a tree with no items", () => {
    const tree: FilterTree = { conjunction: "and", items: [] };
    expect(buildFilterTreeSql(tree, params)).toBe("");
  });

  it("generates IS NULL for a single is_empty condition", () => {
    const tree: FilterTree = {
      conjunction: "and",
      items: [{ kind: "condition", columnId: "col1", op: "is_empty" }],
    };
    const sql = buildFilterTreeSql(tree, params);
    expect(sql).toContain("IS NULL");
  });

  it("joins conditions within an OR group using OR", () => {
    const tree: FilterTree = {
      conjunction: "and",
      items: [
        {
          kind: "group",
          conjunction: "or",
          items: [
            { kind: "condition", columnId: "col1", op: "equals", value: "x" },
            { kind: "condition", columnId: "col1", op: "equals", value: "y" },
          ],
        },
      ],
    };
    const sql = buildFilterTreeSql(tree, params);
    expect(sql).toContain(" OR ");
    expect(params).toEqual(["x", "y"]);
  });

  it("drops conditions with empty string values for equals", () => {
    const tree: FilterTree = {
      conjunction: "and",
      items: [
        { kind: "condition", columnId: "col1", op: "equals", value: "" },
      ],
    };
    // Empty string equals is a no-op — returns empty
    expect(buildFilterTreeSql(tree, params)).toBe("");
  });
});
