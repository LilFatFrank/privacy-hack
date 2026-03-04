-- Add "processing" to activity status check constraint
-- This prevents race conditions in claim/reclaim by atomically locking the activity
ALTER TABLE activity DROP CONSTRAINT activity_status_check;
ALTER TABLE activity ADD CONSTRAINT activity_status_check CHECK (status IN ('open', 'processing', 'settled', 'cancelled'));
