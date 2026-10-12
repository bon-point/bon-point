-- Bon Point : confirmations atomiques de créneaux individuels, notifications privées.
-- Une demande reste libre tant qu'elle n'est pas confirmée par l'admin.
-- Un rendez-vous confirmé bloque sa durée entière + 10 min de transition.
-- SQLite déclenche RAISE(ABORT) à l'intérieur même de la transaction concurrente.
CREATE TRIGGER IF NOT EXISTS prevent_confirmed_booking_overlap_update
BEFORE UPDATE OF status, starts_at_utc, session_type ON booking_requests
WHEN NEW.status='confirmed' AND NEW.starts_at_utc IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'booking-slot-conflict')
 WHERE EXISTS(
  SELECT 1 FROM booking_requests b
  WHERE b.id<>NEW.id AND b.status='confirmed' AND b.starts_at_utc IS NOT NULL
    AND unixepoch(NEW.starts_at_utc) < unixepoch(b.starts_at_utc)
      + CASE WHEN b.session_type='course' THEN 60*60 ELSE 20*60 END + 10*60
    AND unixepoch(b.starts_at_utc) < unixepoch(NEW.starts_at_utc)
      + CASE WHEN NEW.session_type='course' THEN 60*60 ELSE 20*60 END + 10*60
 );
END;

CREATE TRIGGER IF NOT EXISTS prevent_confirmed_booking_overlap_insert
BEFORE INSERT ON booking_requests
WHEN NEW.status='confirmed' AND NEW.starts_at_utc IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'booking-slot-conflict')
 WHERE EXISTS(
  SELECT 1 FROM booking_requests b
  WHERE b.status='confirmed' AND b.starts_at_utc IS NOT NULL
    AND unixepoch(NEW.starts_at_utc) < unixepoch(b.starts_at_utc)
      + CASE WHEN b.session_type='course' THEN 60*60 ELSE 20*60 END + 10*60
    AND unixepoch(b.starts_at_utc) < unixepoch(NEW.starts_at_utc)
      + CASE WHEN NEW.session_type='course' THEN 60*60 ELSE 20*60 END + 10*60
 );
END;

-- Chaque destinataire a une ligne indépendante pour qu'un échec ne
-- redéclenche pas les courriels déjà transmis aux autres destinataires.
CREATE TABLE IF NOT EXISTS booking_mail_jobs (
 booking_id TEXT NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN (
   'confirmation_parent','confirmation_owner','declined_parent',
   'reminder_parent','reminder_owner')),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 claimed_at TEXT,
 next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 sent_at TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY (booking_id,kind)
);
CREATE INDEX IF NOT EXISTS idx_booking_mail_jobs_due ON booking_mail_jobs(state,next_attempt_at);

-- Les notifications naissent dans la même transaction que la confirmation.
-- Aucun e-mail n'est envoyé par un trigger (il sera transmis par le Worker).
CREATE TRIGGER IF NOT EXISTS booking_confirmed_queue_mail
AFTER UPDATE OF status ON booking_requests
WHEN NEW.status='confirmed' AND OLD.status<>'confirmed'
BEGIN
 INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind) VALUES(NEW.id,'confirmation_parent');
 INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind) VALUES(NEW.id,'confirmation_owner');
END;

CREATE TRIGGER IF NOT EXISTS booking_declined_queue_mail
AFTER UPDATE OF status ON booking_requests
WHEN NEW.status='declined' AND OLD.status='requested'
BEGIN
 INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind) VALUES(NEW.id,'declined_parent');
END;

-- Assure le suivi des rares confirmations antérieures à ce déploiement.
INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind)
 SELECT id,'confirmation_parent' FROM booking_requests WHERE status='confirmed';
INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind)
 SELECT id,'confirmation_owner' FROM booking_requests WHERE status='confirmed';
