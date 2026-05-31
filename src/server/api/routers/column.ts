import { createTRPCRouter } from "~/server/api/trpc";
import { list, ensureIndexes } from "./column/columnQuery";
import { create } from "./column/columnCreate";
import { backfill } from "./column/columnBackfill";
import { deleteColumn, removeFromView } from "./column/columnDelete";
import { update } from "./column/columnUpdate";

export const columnRouter = createTRPCRouter({
  list,
  create,
  backfill,
  delete: deleteColumn,
  removeFromView,
  update,
  ensureIndexes,
});
