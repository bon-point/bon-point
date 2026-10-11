-- Bon Point : demandes de rendez-vous, diagnostic pédagogique et portail parents.
-- Aucune donnée bancaire, aucun nom complet d'élève.
CREATE TABLE IF NOT EXISTS parent_accounts (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_login_codes (
  email TEXT PRIMARY KEY REFERENCES parent_accounts(email) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS parent_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES parent_accounts(email) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parent_sessions_email ON parent_sessions(email);
CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  requested_date TEXT NOT NULL,
  period TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','declined')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_booking_email ON booking_requests(parent_email,created_at);
CREATE TABLE IF NOT EXISTS diagnostic_requests (
  id TEXT PRIMARY KEY,
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapters TEXT NOT NULL,
  goal TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diagnostic_email ON diagnostic_requests(parent_email,created_at);
CREATE TABLE IF NOT EXISTS progress_entries (
  id TEXT PRIMARY KEY,
  parent_email TEXT NOT NULL REFERENCES parent_accounts(email) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  subject TEXT NOT NULL,
  summary TEXT NOT NULL,
  next_step TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_progress_parent ON progress_entries(parent_email,session_date);
CREATE TABLE IF NOT EXISTS invoices (
  invoice_number TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  parent_email TEXT NOT NULL REFERENCES parent_accounts(email),
  total_cents INTEGER NOT NULL CHECK(total_cents>0),
  issued_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparation' CHECK(status IN ('preparation','issued')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoice_parent ON invoices(parent_email,issued_on);
