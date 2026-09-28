-- Marketing signup database schema.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK (role IN ('Student', 'Parent', 'Teacher')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    password_hash TEXT NOT NULL,
    signup_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Pending'))
);

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    dob DATE,
    gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    location TEXT,
    institution_name TEXT,
    grade_or_subject TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marketing_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    opt_in_email INTEGER NOT NULL DEFAULT 0 CHECK (opt_in_email IN (0, 1)),
    opt_in_sms INTEGER NOT NULL DEFAULT 0 CHECK (opt_in_sms IN (0, 1)),
    opt_in_push INTEGER NOT NULL DEFAULT 0 CHECK (opt_in_push IN (0, 1)),
    preferred_content_type TEXT CHECK (preferred_content_type IS NULL OR preferred_content_type IN ('Courses', 'Events', 'Discounts', 'Newsletters')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS signup_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type TEXT NOT NULL DEFAULT 'Signup' CHECK (action_type IN ('Signup', 'Login', 'Logout')),
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_type TEXT,
    referral_source TEXT NOT NULL DEFAULT 'Organic',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_preferences_user_id ON marketing_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_signup_activity_user_id ON signup_activity(user_id);