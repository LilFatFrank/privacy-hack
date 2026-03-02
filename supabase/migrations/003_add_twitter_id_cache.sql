-- Migration: Add twitter_id_cache table for X handle → numeric ID mapping
-- Used by resolve-x API to correctly set Privy subject as numeric ID

CREATE TABLE twitter_id_cache (
  twitter_handle TEXT PRIMARY KEY,
  twitter_numeric_id TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

ALTER TABLE twitter_id_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON twitter_id_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
