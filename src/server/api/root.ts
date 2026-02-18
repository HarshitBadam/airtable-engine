import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

import * as base from "./routers/base";
import * as table from "./routers/table";
import * as column from "./routers/column";
import * as row from "./routers/row";
import * as view from "./routers/view";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  base: base.baseRouter,
  table: table.tableRouter,
  column: column.columnRouter,
  row: row.rowRouter,
  view: view.viewRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
