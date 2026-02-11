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

export const viewConfigSchema = z.object({
  search: z.string(),
  filters: z.array(filterSchema),
  filterConjunction: z.enum(["and", "or"]).default("and"),
  sorts: z.array(sortSchema).default([]),
  hiddenColumnIds: z.array(z.string()),
  columnOrderIds: z.array(z.string()).default([]),
});

export type Filter = z.infer<typeof filterSchema>;
export type Sort = z.infer<typeof sortSchema>;
export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const defaultViewConfig: ViewConfig = {
  search: "",
  filters: [],
  filterConjunction: "and",
  sorts: [],
  hiddenColumnIds: [],
  columnOrderIds: [],
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
      sorts: c.sorts,
      hiddenColumnIds: hidden,
      columnOrderIds: c.columnOrderIds,
    });
  }
  
