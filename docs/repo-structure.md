# Repo structure

```text
.
├── prisma/
│   ├── schema.prisma          database models
│   └── migrations/            schema and index history
├── src/
│   ├── app/                   Next.js routes and layouts
│   ├── components/
│   │   └── grid/              spreadsheet UI and client state
│   ├── server/
│   │   ├── api/               tRPC context, limits, and routers
│   │   ├── auth/              NextAuth configuration
│   │   ├── db/                Prisma client and dynamic indexes
│   │   ├── seed/              starter table data
│   │   └── sql/               sort, filter, cursor, and escape builders
│   ├── shared/                schemas shared by client and server
│   ├── trpc/                  React tRPC client
│   └── styles/                global styles and CSS modules
├── docs/                      project documentation
├── benchmark-results/         committed latency output and chart
├── latency-benchmark.ts       main database benchmark
├── batch-benchmark.ts         bulk-insert batch comparison
├── stress-test.ts             concurrent write checks
├── render-sweep-chart.ts      renders the offset-depth chart
└── start-database.sh          local PostgreSQL container
```

## Useful entry points

To follow a page load:

1. [`src/app/bases/[baseId]/tables/[tableId]/`](../src/app/bases/[baseId]/tables/[tableId]/)
2. [`src/components/grid/`](../src/components/grid/)
3. [`src/server/api/routers/row/infiniteProcedure.ts`](../src/server/api/routers/row/infiniteProcedure.ts)

For a deep scrollbar jump, start in [`useJumpCache.ts`](../src/components/grid/hooks/useJumpCache.ts), then read [`windowFetchProcedure.ts`](../src/server/api/routers/row/windowFetchProcedure.ts).

For writes, start with:

- [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts) for insert, reorder, and delete;
- [`cellMutations.ts`](../src/server/api/routers/row/cellMutations.ts) for edits and bulk rows;
- [`sortProcedures.ts`](../src/server/api/routers/row/sortProcedures.ts) for ranks and permanent sorts.

The SQL builders are under [`src/server/sql/`](../src/server/sql/), with their unit tests in the adjacent `__tests__` directory. The schema is [`prisma/schema.prisma`](../prisma/schema.prisma).
