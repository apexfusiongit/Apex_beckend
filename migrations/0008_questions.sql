-- Migration 0008: Questions table
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    marks INTEGER DEFAULT 1,
    order_no INTEGER NOT NULL,
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);
