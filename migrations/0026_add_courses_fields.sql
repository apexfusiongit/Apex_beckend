-- Migration 0026: Add missing fields to courses table
ALTER TABLE courses ADD COLUMN teacher_id INTEGER;
ALTER TABLE courses ADD COLUMN slug TEXT;
ALTER TABLE courses ADD COLUMN price REAL DEFAULT 0;
ALTER TABLE courses ADD COLUMN is_free BOOLEAN DEFAULT 1;
ALTER TABLE courses ADD COLUMN created_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);
