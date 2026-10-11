-- Queue de notifications Discord sans données nominatives.
CREATE TABLE IF NOT EXISTS discord_notifications (
 event_key TEXT PRIMARY KEY,
 category TEXT NOT NULL,
 message TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','delivered','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_discord_notifications_queue ON discord_notifications(state,created_at);
