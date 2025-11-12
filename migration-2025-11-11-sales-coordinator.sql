-- Create Sales Coordinator mapping table
CREATE TABLE IF NOT EXISTS sales_coordinator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_url text,
  source_names text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_coordinator_name ON sales_coordinator(name);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sales_coordinator;

-- Enable RLS and allow public read/write (dashboard is unauthenticated)
ALTER TABLE sales_coordinator ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow public read access to sales coordinator'
      AND tablename = 'sales_coordinator'
  ) THEN
    CREATE POLICY "Allow public read access to sales coordinator"
      ON sales_coordinator FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow public insert to sales coordinator'
      AND tablename = 'sales_coordinator'
  ) THEN
    CREATE POLICY "Allow public insert to sales coordinator"
      ON sales_coordinator FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow public update to sales coordinator'
      AND tablename = 'sales_coordinator'
  ) THEN
    CREATE POLICY "Allow public update to sales coordinator"
      ON sales_coordinator FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;


