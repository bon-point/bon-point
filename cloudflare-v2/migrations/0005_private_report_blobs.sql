-- Stockage privé de petits récapitulatifs PDF sur D1 (≤ 700 Ko), sans bucket public.
CREATE TABLE IF NOT EXISTS session_file_blobs(
 file_id TEXT PRIMARY KEY REFERENCES session_files(id) ON DELETE CASCADE,
 content_base64 TEXT NOT NULL
);
