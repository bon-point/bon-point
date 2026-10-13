PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents>=100),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO offers(id,title,description,price_cents,sort_order) VALUES
 ('seance','Séance ciblée','1 heure individuelle en visioconférence',5000,1),
 ('progression','Progression','4 heures individuelles réparties sur 4 semaines',19000,2),
 ('ambition','Ambition','8 heures individuelles réparties sur 4 semaines',35000,3),
 ('brevet','Brevet Excellence','12 heures de préparation au brevet',79000,4),
 ('bac','Bac Excellence','20 heures de préparation au bac',129000,5);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  locked_price_cents INTEGER NOT NULL CHECK(locked_price_cents>=100),
  parent_email TEXT NOT NULL,
  grade TEXT NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('meet','discord')),
  meet_url TEXT,
  discord_invite TEXT,
  expires_at TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('proposed','creating','awaiting_payment','paid','cancelled')),
  created_at TEXT NOT NULL,
  parent_terms_at TEXT,
  paid_at TEXT,
  stripe_session_id TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(state);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('confirmation','withdrawal')),
  state TEXT NOT NULL CHECK(state IN ('queued','sending','sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(state,attempts);
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  order_ref TEXT,
  created_at TEXT NOT NULL
);