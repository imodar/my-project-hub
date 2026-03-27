
-- Add is_default column to all list tables
ALTER TABLE task_lists ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE market_lists ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE document_lists ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE place_lists ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Mark the oldest family list per family as default
UPDATE task_lists SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (family_id) id FROM task_lists
  WHERE type = 'family' ORDER BY family_id, updated_at ASC
);

UPDATE market_lists SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (family_id) id FROM market_lists
  WHERE type = 'family' ORDER BY family_id, created_at ASC
);

UPDATE document_lists SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (family_id) id FROM document_lists
  WHERE type = 'family' ORDER BY family_id, updated_at ASC
);

UPDATE place_lists SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (family_id) id FROM place_lists
  WHERE type = 'family' ORDER BY family_id, updated_at ASC
);
