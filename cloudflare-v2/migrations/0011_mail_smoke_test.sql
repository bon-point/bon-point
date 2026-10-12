-- One-time safe transactional e-mail connectivity test for Bon Point.
-- No orders, student data or parent recipients.
CREATE TABLE IF NOT EXISTS mail_delivery_checks (
  test_key TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('sending','accepted','failed')),
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
