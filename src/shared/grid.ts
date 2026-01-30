import { z } from "zod";

export const filterSchema = z.discriminatedUnion("op", [
  z.object({ columnId: z.string(), op: z.literal("is_empty") }),
  z.object({ columnId: z.string(), op: z.literal("is_not_empty") }),
  z.object({ columnId: z.string(), op: z.literal("contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("not_contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("equals"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("gt"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("lt"), value: z.number() }),
]);

export const sortSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
  type: z.enum(["TEXT", "NUMBER"]),
});

export const viewConfigSchema = z.object({
  search: z.string(),
  filters: z.array(filterSchema),
  sort: sortSchema.nullable(),
  hiddenColumnIds: z.array(z.string()),
});

export type Filter = z.infer<typeof filterSchema>;
export type Sort = z.infer<typeof sortSchema>;
export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const defaultViewConfig: ViewConfig = {
  search: "",
  filters: [],
  sort: null,
  hiddenColumnIds: [],
};

export function normalizeViewConfig(raw: unknown): ViewConfig {
  const parsed = viewConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultViewConfig;
}

export function configFingerprint(c: ViewConfig): string {
  const filters = [...c.filters].sort((a, b) => {
    const ak = `${a.columnId}|${a.op}|${"value" in a ? String((a as any).value) : ""}`;
    const bk = `${b.columnId}|${b.op}|${"value" in b ? String((b as any).value) : ""}`;
    return ak.localeCompare(bk);
  });

  const hidden = [...c.hiddenColumnIds].sort();

  return JSON.stringify({
    search: c.search,
    filters,
    sort: c.sort,
    hiddenColumnIds: hidden,
  });
}
