-- Track a permission-write intent BEFORE calling Discord.
-- If a Worker is interrupted after PUT /permissions but before recording success,
-- the next run must still recognize and revoke its own overwrite.
ALTER TABLE discord_room_allocations ADD COLUMN grant_attempted_at TEXT;
