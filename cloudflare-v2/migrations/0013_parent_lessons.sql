-- Enrichissement facultatif des comptes rendus : aucun nom d'élève supplémentaire.
ALTER TABLE progress_entries ADD COLUMN strengths TEXT;
ALTER TABLE progress_entries ADD COLUMN homework TEXT;
ALTER TABLE progress_entries ADD COLUMN next_objective TEXT;
CREATE INDEX IF NOT EXISTS idx_progress_parent_date ON progress_entries(parent_email,session_date DESC);
