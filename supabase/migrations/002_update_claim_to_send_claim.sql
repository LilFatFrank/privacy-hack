-- Migration: Update 'claim' type to 'send_claim'

-- Update existing 'claim' activities to 'send_claim'
UPDATE activity SET type = 'send_claim' WHERE type = 'claim';

-- Update the type constraint
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_type_check;
ALTER TABLE activity ADD CONSTRAINT activity_type_check CHECK (type IN ('send', 'request', 'send_claim'));
