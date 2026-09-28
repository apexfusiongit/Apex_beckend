-- Migration 0017: Course Materials table
CREATE TABLE IF NOT EXISTS course_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE INDEX IF NOT EXISTS idx_course_materials_lesson ON course_materials(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_materials_type ON course_materials(type);
