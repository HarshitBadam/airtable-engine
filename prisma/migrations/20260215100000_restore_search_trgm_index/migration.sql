-- Restore the GIN trigram index on Row.searchText that was accidentally
-- dropped in migration 20260204113722_add_last_opened_at.
-- Without this, every `searchText ILIKE '%query%'` does a full table scan.
CREATE INDEX IF NOT EXISTS "Row_searchText_trgm_idx"
ON "Row"
USING GIN ("searchText" gin_trgm_ops);
