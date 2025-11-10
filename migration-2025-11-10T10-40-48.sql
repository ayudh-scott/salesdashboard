-- Create metadata table
CREATE TABLE IF NOT EXISTS _table_metadata (
  table_name text PRIMARY KEY,
  display_name text NOT NULL,
  airtable_table_id text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create index on metadata
CREATE INDEX IF NOT EXISTS idx_table_metadata_display_name ON _table_metadata(display_name);

-- Table: Order Report
-- Create table: Order Report
CREATE TABLE IF NOT EXISTS order_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE NOT NULL,
  raw_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted boolean DEFAULT false,
  jobsheet_number text,
  order_date timestamp with time zone,
  order_id text,
  expected_delivery_date timestamp with time zone,
  actual_delivery_date timestamp with time zone,
  key_account_manager__kam_ text,
  order_status text,
  customer_name text,
  product text,
  description text,
  factory text,
  total_quantity numeric,
  size_breakup text,
  base_of numeric,
  base_sn numeric,
  add_on_of numeric,
  add_on_sn numeric,
  total_of text,
  total_sn text,
  total_stitching_cost text,
  add_on_cost numeric,
  total_add_on_cost text,
  fabric_consumption numeric,
  fabric_used__kgs_ text,
  fabric_rate numeric,
  fabric_cost text,
  trims_cost_pc numeric,
  total_trims_cost text,
  total_material_cost text,
  total_cost text,
  overhead numeric,
  c_o_g_s text,
  margin__ numeric,
  sales_value__ex_taxes_ text,
  sp text,
  branding_cost numeric,
  total_sales__including_branding_ text,
  gst_ text,
  gst_amount text,
  total_sales__including_gst_ text,
  item_type text,
  rmp_category text,
  rmp_class text,
  rmp_brand text,
  xs numeric,
  tailor_report text[],
  tailor_report_2 text,
  tailor_report_3 text,
  tailor_report_4 text,
  tailor_report_5 text,
  tailor_report_6 text,
  tailor_report_7 text
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_report;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_report_airtable_id ON order_report(airtable_id);
CREATE INDEX IF NOT EXISTS idx_order_report_deleted ON order_report(deleted);

-- Insert/update metadata
INSERT INTO _table_metadata (table_name, display_name, airtable_table_id, last_synced_at)
VALUES ('order_report', 'Order Report', 'Order Report', now())
ON CONFLICT (table_name) 
DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  last_synced_at = EXCLUDED.last_synced_at;

-- Table: Tailor Report
-- Create table: Tailor Report
CREATE TABLE IF NOT EXISTS tailor_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE NOT NULL,
  raw_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted boolean DEFAULT false,
  airtable_field_id text,
  tailor text,
  jobsheet_number text[],
  base_of__from_base_of_ text,
  base_sn__from_base_sn_ text,
  add_on_of text,
  add_on_sn__from_add_on_sn_ text,
  of_rate text,
  sn_rate text,
  size_breakup text,
  total_quantity numeric,
  of_amount text,
  sn_amount text,
  total_amount text,
  order_date__from_order_date_ text,
  chotu text,
  picking_date_time timestamp with time zone,
  week_number text,
  updated_on timestamp with time zone,
  payment_status text
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tailor_report;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tailor_report_airtable_id ON tailor_report(airtable_id);
CREATE INDEX IF NOT EXISTS idx_tailor_report_deleted ON tailor_report(deleted);

-- Insert/update metadata
INSERT INTO _table_metadata (table_name, display_name, airtable_table_id, last_synced_at)
VALUES ('tailor_report', 'Tailor Report', 'Tailor Report', now())
ON CONFLICT (table_name) 
DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  last_synced_at = EXCLUDED.last_synced_at;

-- Table: Customers
-- Create table: Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE NOT NULL,
  raw_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted boolean DEFAULT false,
  airtable_field_id text,
  name text,
  email text,
  phone text,
  sc_name text,
  sc_email text,
  dealer_name text,
  dealer_email text,
  customer_first_name text,
  customer_last_name text,
  customer_company_name text,
  registered_by text,
  onboarded text,
  approved text,
  zone text,
  rmp_price_type_name text,
  gst text,
  address text,
  state text,
  city text,
  zip_code text
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_airtable_id ON customers(airtable_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted);

-- Insert/update metadata
INSERT INTO _table_metadata (table_name, display_name, airtable_table_id, last_synced_at)
VALUES ('customers', 'Customers', 'Customers', now())
ON CONFLICT (table_name) 
DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  last_synced_at = EXCLUDED.last_synced_at;

-- Table: RMP Orders
-- Create table: RMP Orders
CREATE TABLE IF NOT EXISTS rmp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE NOT NULL,
  raw_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted boolean DEFAULT false,
  order_id text,
  order_date timestamp with time zone,
  delivery_required_on timestamp with time zone,
  remark text,
  order_status text,
  delivered_in__days_ numeric,
  dispatch_date timestamp with time zone,
  customer_name text,
  sales_coordinator text,
  customer_type text,
  customer_s_mobile numeric,
  city text,
  state text,
  sku text,
  class text,
  color text,
  size text,
  product_name text,
  product_category text,
  qty numeric,
  price numeric,
  amount numeric,
  gst_amount numeric,
  total_amount numeric
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rmp_orders;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rmp_orders_airtable_id ON rmp_orders(airtable_id);
CREATE INDEX IF NOT EXISTS idx_rmp_orders_deleted ON rmp_orders(deleted);

-- Insert/update metadata
INSERT INTO _table_metadata (table_name, display_name, airtable_table_id, last_synced_at)
VALUES ('rmp_orders', 'RMP Orders', 'RMP Orders', now())
ON CONFLICT (table_name) 
DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  last_synced_at = EXCLUDED.last_synced_at;
