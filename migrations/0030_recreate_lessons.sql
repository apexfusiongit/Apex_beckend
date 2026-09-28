-- Migration 0030: Recreate lessons table with all required columns
-- This ensures the lessons table has all the columns it needs including chapter_id

DROP TABLE IF EXISTS lessons;

CREATE TABLE lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    chapter_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    video_key TEXT NOT NULL,
    thumbnail TEXT,
    duration INTEGER,
    order_no INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(order_no);
