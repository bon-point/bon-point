-- Deux salons vocaux prédéfinis ; aucun changement de permissions Discord.
-- Statut d'un contrôle en lecture seule des salons et de leur catégorie.
CREATE TABLE IF NOT EXISTS discord_room_audits (
 name TEXT PRIMARY KEY,
 room_ids TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('verified','blocked')),
 reason TEXT NOT NULL,
 category_id TEXT,
 checked_at TEXT NOT NULL
);

-- Réservations futures : aucune ligne ajoutée sans autorisation du responsable.
-- Les ID de participants ne sont pas enregistrés avant accord et validation.
CREATE TABLE IF NOT EXISTS discord_room_allocations (
 booking_id TEXT PRIMARY KEY REFERENCES booking_requests(id) ON DELETE CASCADE,
 room_id TEXT NOT NULL CHECK(room_id IN ('1558922846896529418','1558922881386418276')),
 participant_discord_id TEXT NOT NULL,
 starts_at_utc TEXT NOT NULL,
 ends_at_utc TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','active','completed','cancelled')),
 access_granted_at TEXT,
 access_revoked_at TEXT,
 created_at TEXT NOT NULL,
 CHECK(ends_at_utc>starts_at_utc)
);
CREATE INDEX IF NOT EXISTS idx_discord_rooms_schedule ON discord_room_allocations(room_id,starts_at_utc,ends_at_utc,state);

-- L'interdiction de chevauchement est atomique au niveau D1, même si deux
-- réservations sont créées en même temps ou si une attribution est modifiée.
CREATE TRIGGER IF NOT EXISTS discord_rooms_no_overlap_insert
BEFORE INSERT ON discord_room_allocations
WHEN NEW.state IN ('planned','active') AND EXISTS (
 SELECT 1 FROM discord_room_allocations old
 WHERE old.room_id=NEW.room_id AND old.state IN ('planned','active')
 AND julianday(NEW.starts_at_utc)<julianday(old.ends_at_utc)+(10.0/1440.0)
 AND julianday(NEW.ends_at_utc)+(10.0/1440.0)>julianday(old.starts_at_utc)
)
BEGIN SELECT RAISE(ABORT,'Discord voice room schedule conflict'); END;

CREATE TRIGGER IF NOT EXISTS discord_rooms_no_overlap_update
BEFORE UPDATE OF room_id,starts_at_utc,ends_at_utc,state ON discord_room_allocations
WHEN NEW.state IN ('planned','active') AND EXISTS (
 SELECT 1 FROM discord_room_allocations old
 WHERE old.booking_id<>NEW.booking_id AND old.room_id=NEW.room_id
 AND old.state IN ('planned','active')
 AND julianday(NEW.starts_at_utc)<julianday(old.ends_at_utc)+(10.0/1440.0)
 AND julianday(NEW.ends_at_utc)+(10.0/1440.0)>julianday(old.starts_at_utc)
)
BEGIN SELECT RAISE(ABORT,'Discord voice room schedule conflict'); END;
