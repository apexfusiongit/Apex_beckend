-- Migration 0018: Video Assets table
CREATE TABLE IF NOT EXISTS video_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    thumbnail_key TEXT,
    duration INTEGER,
    file_size INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE INDEX IF NOT EXISTS idx_video_assets_lesson ON video_assets(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_status ON video_assets(status);
