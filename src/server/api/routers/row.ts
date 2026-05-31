import { createTRPCRouter } from "../trpc";
import { infinite } from "./row/infiniteProcedure";
import { windowFetch } from "./row/windowFetchProcedure";
import { searchMatchCount, findEdgeMatch } from "./row/searchProcedures";
import { applyPermanentSort, computeViewRanks } from "./row/sortProcedures";
import { insertAt, duplicateAt, deleteRow, clearData, reorder } from "./row/rowMutations";
import { addMany, updateCell } from "./row/cellMutations";

export const rowRouter = createTRPCRouter({
  infinite,
  applyPermanentSort,
  computeViewRanks,
  addMany,
  insertAt,
  duplicateAt,
  delete: deleteRow,
  clearData,
  reorder,
  updateCell,
  windowFetch,
  searchMatchCount,
  findEdgeMatch,
});
