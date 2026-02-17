-- Remove ALL GIN trigram indexes from the Row table.
--
-- The global searchText trigram index speeds up ILIKE substring search but
-- makes bulk inserts significantly slower due to per-row trigram
-- decomposition overhead.  Per-column _tg indexes have the same problem.
--
-- ILIKE still works without these indexes (sequential scan).  The
-- trade-off strongly favours fast writes for our workload.

-- 1) Global searchText trigram index
DROP INDEX IF EXISTS "Row_searchText_trgm_idx";

-- 2) Per-column trigram indexes (dynamically created by column.ts)
--    These follow the naming pattern: r_<tableId8>_<colId8>_tg
--    and the older pattern: r_<tableId8>_<colId8>_t_g
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'Row'
      AND (indexname LIKE 'r_%\_tg' OR indexname LIKE 'r_%\_t\_g')
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
  END LOOP;
END;
$$;
