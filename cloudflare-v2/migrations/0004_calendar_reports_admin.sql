-- Bon Point : créneaux en heure de Paris, administration sécurisée et fiches PDF privées.
-- Migration additive et non destructive (D1 existante).
ALTER TABLE booking_requests ADD COLUMN time_local TEXT;
ALTER TABLE booking_requests ADD COLUMN starts_at_utc TEXT;
ALTER TABLE booking_requests ADD COLUMN session_type TEXT DEFAULT 'intro';
ALTER TABLE booking_requests ADD COLUMN offer_id TEXT;
ALTER TABLE booking_requests ADD COLUMN reminder_due_at TEXT;
ALTER TABLE booking_requests ADD COLUMN reminder_sent_at TEXT;
ALTER TABLE booking_requests ADD COLUMN paid_notice_sent_at TEXT;
ALTER TABLE booking_requests ADD COLUMN order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_booking_reminders ON booking_requests(status,reminder_due_at);
CREATE INDEX IF NOT EXISTS idx_booking_slot ON booking_requests(starts_at_utc,status);
CREATE TABLE IF NOT EXISTS admin_login_codes (
 email TEXT PRIMARY KEY,
 code_hash TEXT NOT NULL,
 sent_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS session_files (
 id TEXT PRIMARY KEY,
 progress_id TEXT NOT NULL REFERENCES progress_entries(id) ON DELETE CASCADE,
 parent_email TEXT NOT NULL REFERENCES parent_accounts(email),
 file_name TEXT NOT NULL,
 content_type TEXT NOT NULL DEFAULT 'application/pdf',
 size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=5242880),
 r2_key TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_files_parent ON session_files(parent_email,progress_id);
