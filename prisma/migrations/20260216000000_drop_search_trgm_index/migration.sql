-- Drop the GIN trigram index on Row.searchText.
-- The index speeds up ILIKE searches but makes bulk inserts (100K+ rows)
-- 4-6x slower due to per-row trigram decomposition overhead.
-- ILIKE still works without the index (sequential scan); the trade-off
-- strongly favours fast writes for our workload.
DROP INDEX IF EXISTS "Row_searchText_trgm_idx";
