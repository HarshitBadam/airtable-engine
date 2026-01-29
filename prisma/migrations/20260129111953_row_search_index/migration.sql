-- Create index for search text
CREATE INDEX IF NOT EXISTS "Row_searchText_trgm_idx"
ON "Row"
USING GIN ("searchText" gin_trgm_ops);
