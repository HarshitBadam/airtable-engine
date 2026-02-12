import { z } from "zod";

export const filterSchema = z.discriminatedUnion("op", [
  z.object({ columnId: z.string(), op: z.literal("is_empty") }),
  z.object({ columnId: z.string(), op: z.literal("is_not_empty") }),
  z.object({ columnId: z.string(), op: z.literal("contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("not_contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("equals"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("not_equals"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("gt"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("lt"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("gte"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("lte"), value: z.number() }),
]);

export const sortSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
  type: z.enum(["TEXT", "NUMBER"]),
});

export type Filter = z.infer<typeof filterSchema>;
export type Sort = z.infer<typeof sortSchema>;

/* ============================================================
   Filter tree (condition groups)
   ============================================================ */

/**
 * A condition leaf in the filter tree.
 * Matches the existing flat Filter shape but adds `kind` discriminator.
 */
export const filterTreeConditionSchema = z.object({
  kind: z.literal("condition"),
  columnId: z.string(),
  op: z.string(), // one of the filter operators
  value: z.union([z.string(), z.number()]).optional(),
});

export type FilterTreeCondition = z.infer<typeof filterTreeConditionSchema>;

/**
 * A group node: has its own conjunction (AND / OR) and a list of child items.
 * Children can be conditions or nested groups (max 2 levels in UI).
 */
export interface FilterTreeGroup {
  kind: "group";
  conjunction: "and" | "or";
  items: FilterTreeItem[];
}

export type FilterTreeItem = FilterTreeCondition | FilterTreeGroup;

const filterTreeGroupSchema: z.ZodType<FilterTreeGroup> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    conjunction: z.enum(["and", "or"]),
    items: z.array(
      z.union([filterTreeConditionSchema, filterTreeGroupSchema as z.ZodType<FilterTreeGroup>]),
    ),
  }),
);

export const filterTreeItemSchema: z.ZodType<FilterTreeItem> = z.union([
  filterTreeConditionSchema,
  filterTreeGroupSchema,
]);

/**
 * The root filter tree: a conjunction + top-level items.
 * Replaces flat `filters[]` + `filterConjunction` when groups are present.
 */
export const filterTreeSchema = z.object({
  conjunction: z.enum(["and", "or"]),
  items: z.array(filterTreeItemSchema),
});

export type FilterTree = z.infer<typeof filterTreeSchema>;

export const viewConfigSchema = z.object({
  search: z.string(),
  filters: z.array(filterSchema),
  filterConjunction: z.enum(["and", "or"]).default("and"),
  /** Tree-structured filters (condition groups). When present, takes precedence over flat filters. */
  filterTree: filterTreeSchema.optional(),
  sorts: z.array(sortSchema).default([]),
  permanentSorts: z.array(sortSchema).default([]),
  autoSort: z.boolean().default(true),
  hiddenColumnIds: z.array(z.string()),
  columnOrderIds: z.array(z.string()).default([]),
  // Per-view row ordering (set when user manually drags rows).
  // When empty, rows display in default rowIndex order.
  // When populated, defines the display order of rows for this view.
  rowOrderIds: z.array(z.string()).default([]),
});

export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const defaultViewConfig: ViewConfig = {
  search: "",
  filters: [],
  filterConjunction: "and",
  filterTree: undefined,
  sorts: [],
  permanentSorts: [],
  autoSort: true,
  hiddenColumnIds: [],
  columnOrderIds: [],
  rowOrderIds: [],
};

export function normalizeViewConfig(raw: unknown): ViewConfig {
  // Backward compat: old configs may have `sort: Sort | null` instead of `sorts: Sort[]`
  if (raw && typeof raw === "object" && "sort" in raw && !("sorts" in raw)) {
    const { sort, ...rest } = raw as Record<string, unknown>;
    const sorts = sort ? [sort] : [];
    const parsed = viewConfigSchema.safeParse({ ...rest, sorts });
    return parsed.success ? parsed.data : defaultViewConfig;
  }
  const parsed = viewConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultViewConfig;
}

export function configFingerprint(c: ViewConfig): string {
    const filters = [...c.filters].sort((a, b) => {
      const av = "value" in a ? String(a.value) : "";
      const bv = "value" in b ? String(b.value) : "";
  
      const ak = `${a.columnId}|${a.op}|${av}`;
      const bk = `${b.columnId}|${b.op}|${bv}`;
  
      return ak.localeCompare(bk);
    });
  
    const hidden = [...c.hiddenColumnIds].sort();
  
    return JSON.stringify({
      search: c.search,
      filters,
      filterConjunction: c.filterConjunction,
      filterTree: c.filterTree,
      sorts: c.sorts,
      permanentSorts: c.permanentSorts,
      autoSort: c.autoSort,
      hiddenColumnIds: hidden,
      columnOrderIds: c.columnOrderIds,
      rowOrderIds: c.rowOrderIds,
    });
  }
  
