-- État minimal d'installation du nouveau bot Discord (aucun secret, aucune donnée élève).
CREATE TABLE IF NOT EXISTS discord_bot_state (
 name TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
