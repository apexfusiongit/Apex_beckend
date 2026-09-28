-- Migration 0028: Add video position tracking to progress table
ALTER TABLE progress ADD COLUMN last_position INTEGER DEFAULT 0;
ALTER TABLE progress ADD COLUMN last_accessed_at DATETIME;
