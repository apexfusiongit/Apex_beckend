-- Add platform features to the existing apex-fusion-db schema. No existing
-- course, lesson, user, payment, enrollment or progress rows are removed.

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  dob TEXT,
  gender TEXT,
  location TEXT,
  institution_name TEXT,
  grade_or_subject TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS marketing_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  opt_in_email INTEGER NOT NULL DEFAULT 0,
  opt_in_sms INTEGER NOT NULL DEFAULT 0,
  opt_in_push INTEGER NOT NULL DEFAULT 0,
  preferred_content_type TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS signup_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'Signup',
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  device_type TEXT,
  referral_source TEXT NOT NULL DEFAULT 'Organic',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_signup_activity_user_id ON signup_activity(user_id);
ALTER TABLE signup_activity ADD COLUMN source_activity_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_activity_source_activity ON signup_activity(source_activity_id);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_chapters_course_order ON chapters(course_id, order_index);
CREATE TABLE IF NOT EXISTS video_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  duration INTEGER,
  thumbnail_key TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_video_assets_lesson_status ON video_assets(lesson_id, status);
CREATE TABLE IF NOT EXISTS teacher_courses (
  teacher_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  assigned_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (teacher_id, course_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  interval TEXT NOT NULL DEFAULT 'month',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO subscription_plans (name, amount_paise, currency, interval)
VALUES ('Apex Fusion Student Plan', 30000, 'INR', 'month');
CREATE TABLE IF NOT EXISTS user_password_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  password_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, password_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- These columns extend the already existing platform tables. The migration
-- runner tracks applied versions and is safe to run again after success.
ALTER TABLE courses ADD COLUMN thumbnail TEXT;
ALTER TABLE courses ADD COLUMN teacher_id INTEGER;
ALTER TABLE courses ADD COLUMN slug TEXT;
ALTER TABLE courses ADD COLUMN price REAL NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN is_free INTEGER NOT NULL DEFAULT 1;
ALTER TABLE courses ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN created_by INTEGER;
ALTER TABLE courses ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
ALTER TABLE subjects ADD COLUMN class_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON subjects(class_id);
ALTER TABLE lessons ADD COLUMN chapter_id INTEGER;
ALTER TABLE lessons ADD COLUMN description TEXT;
ALTER TABLE lessons ADD COLUMN thumbnail TEXT;
ALTER TABLE lessons ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lessons ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE lessons ADD COLUMN updated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);
ALTER TABLE progress ADD COLUMN last_position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE progress ADD COLUMN last_accessed_at TEXT;
ALTER TABLE payments ADD COLUMN provider TEXT;
ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE payments ADD COLUMN subscription_id INTEGER;
ALTER TABLE payments ADD COLUMN webhook_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_webhook_event ON payments(webhook_event_id);
ALTER TABLE leads ADD COLUMN subject TEXT;
ALTER TABLE leads ADD COLUMN message TEXT;
ALTER TABLE leads ADD COLUMN source TEXT NOT NULL DEFAULT 'website';
