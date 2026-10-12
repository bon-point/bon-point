-- Audit interne d'activation administrateur. Aucun secret ni mot de passe enregistré.
CREATE TABLE IF NOT EXISTS admin_readiness_audit (
  name TEXT PRIMARY KEY,
  admin_enabled INTEGER NOT NULL,
  database_present INTEGER NOT NULL,
  mail_key_present INTEGER NOT NULL,
  sender_present INTEGER NOT NULL,
  valid_login_email INTEGER NOT NULL,
  password_meets_minimum INTEGER NOT NULL,
  auth_secret_meets_minimum INTEGER NOT NULL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
