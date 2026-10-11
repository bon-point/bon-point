CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 offer TEXT NOT NULL, email TEXT NOT NULL, delivery TEXT NOT NULL,
 expires_at TEXT NOT NULL, status TEXT NOT NULL,
 session_id TEXT UNIQUE, discord_invite TEXT, emailed INTEGER NOT NULL DEFAULT 0,
 created_at TEXT DEFAULT (datetime('now')), paid_at TEXT
);
CREATE TABLE IF NOT EXISTS withdrawals (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
 order_ref TEXT, acknowledged INTEGER NOT NULL DEFAULT 0,
 created_at TEXT DEFAULT (datetime('now'))
);