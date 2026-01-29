-- Activity table for all payment operations (send, request, claim)
CREATE TABLE activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('send', 'request', 'claim')),
  sender_address TEXT NOT NULL,
  receiver_address TEXT,
  amount NUMERIC NOT NULL,
  token_address TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  message TEXT,
  tx_hash TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,

  -- Claim-specific fields (null for send/request)
  burner_address TEXT,
  encrypted_for_receiver JSONB,
  encrypted_for_sender JSONB,
  deposit_tx_hash TEXT,
  claim_tx_hash TEXT
);

-- Indexes for common queries
CREATE INDEX idx_activity_sender_address ON activity(sender_address);
CREATE INDEX idx_activity_receiver_address ON activity(receiver_address);
CREATE INDEX idx_activity_status ON activity(status);
CREATE INDEX idx_activity_created_at ON activity(created_at DESC);
CREATE INDEX idx_activity_updated_at ON activity(updated_at DESC);
CREATE INDEX idx_activity_amount ON activity(amount);
CREATE INDEX idx_activity_token_address ON activity(token_address);

-- Composite indexes for stats queries
CREATE INDEX idx_activity_sender_status ON activity(sender_address, status);
CREATE INDEX idx_activity_receiver_status ON activity(receiver_address, status);

-- Enable Row Level Security
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read
CREATE POLICY "Allow public read" ON activity
  FOR SELECT
  USING (true);

-- Policy: Only service role can insert/update/delete
CREATE POLICY "Service role full access" ON activity
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
