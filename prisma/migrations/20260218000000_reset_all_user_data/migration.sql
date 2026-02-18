-- One-time data reset: remove all bases and cascaded data so every user
-- starts fresh.  User/Account/Session rows are preserved (logins still work).
--
-- Dynamic per-column sort indexes (ri_*) are dropped first because they
-- reference rows that are about to be deleted.  New indexes are created
-- on-demand when users sort columns.

-- 1) Drop all dynamic per-column sort indexes
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'Row' AND indexname LIKE 'ri_%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
  END LOOP;
END;
$$;

-- 2) Delete all ViewRowRank entries (avoids FK issues during cascade)
DELETE FROM "ViewRowRank";

-- 3) Delete all Bases — cascades to Table → Row, Column, View
DELETE FROM "Base";
