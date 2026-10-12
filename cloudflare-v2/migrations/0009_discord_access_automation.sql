-- Bon Point — identité Discord liée par un code à usage unique envoyé au responsable légal.
-- Aucune permission de salon n'est modifiée par cette migration.
CREATE TABLE IF NOT EXISTS discord_booking_link_codes (
 booking_id TEXT PRIMARY KEY REFERENCES booking_requests(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 consent_attested_at TEXT NOT NULL,
 used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_discord_codes_expiration ON discord_booking_link_codes(expires_at,used_at);

-- Le bot doit pouvoir reprendre une opération interrompue sans attribuer de
-- permissions à une autre réservation ni perdre la nécessité de les révoquer.
ALTER TABLE discord_room_allocations ADD COLUMN access_lease_until TEXT;
ALTER TABLE discord_room_allocations ADD COLUMN revoke_requested_at TEXT;
ALTER TABLE discord_room_allocations ADD COLUMN last_access_error TEXT;
CREATE INDEX IF NOT EXISTS idx_discord_room_access_work ON discord_room_allocations(state,starts_at_utc,ends_at_utc,access_revoked_at);
