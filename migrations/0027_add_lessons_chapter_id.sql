-- Migration 0027: Add chapter_id to lessons table
ALTER TABLE lessons ADD COLUMN chapter_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);

-- Note: Existing lessons will need to be assigned to chapters
-- This is a structural change that requires data migration
