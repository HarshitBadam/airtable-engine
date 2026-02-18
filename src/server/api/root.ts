import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

import * as base from "./routers/base";
import * as table from "./routers/table";
import * as column from "./routers/column";
import * as row from "./routers/row";
import * as view from "./routers/view";

export const appRouter = createTRPCRouter({
  base: base.baseRouter,
  table: table.tableRouter,
  column: column.columnRouter,
  row: row.rowRouter,
  view: view.viewRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
