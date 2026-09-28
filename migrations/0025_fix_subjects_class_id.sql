-- Migration 0025: Add class_id to subjects table and migrate existing data
-- First add the class_id column
ALTER TABLE subjects ADD COLUMN class_id INTEGER;

-- Create index for class_id
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON subjects(class_id);

-- Note: Existing data will need manual migration from class TEXT to class_id FK
-- This is a structural change that requires data migration script
