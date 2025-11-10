-- Create metadata table for tracking synced Airtable tables
CREATE TABLE IF NOT EXISTS _table_metadata (
  table_name text PRIMARY KEY,
  display_name text NOT NULL,
  airtable_table_id text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create index on display_name for faster queries
CREATE INDEX IF NOT EXISTS idx_table_metadata_display_name ON _table_metadata(display_name);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE _table_metadata ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for all users (since this is a read-only dashboard)
-- This allows the anon key to read the metadata
CREATE POLICY "Allow public read access to metadata"
  ON _table_metadata
  FOR SELECT
  USING (true);

-- Note: For write operations (insert/update), you'll need the service role key
-- which is only used server-side, so no additional policy is needed for writes

