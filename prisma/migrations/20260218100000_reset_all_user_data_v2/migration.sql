-- One-time data reset (v2): clear data accumulated since last reset.

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

-- 2) Delete all ViewRowRank entries
DELETE FROM "ViewRowRank";

-- 3) Delete all Bases — cascades to Table → Row, Column, View
DELETE FROM "Base";
