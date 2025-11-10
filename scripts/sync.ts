#!/usr/bin/env tsx

/**
 * Airtable → Supabase Sync Script
 * 
 * This script:
 * 1. Fetches all tables from Airtable
 * 2. For each table, fetches all records
 * 3. Creates/updates Supabase tables with matching schema
 * 4. Upserts all records into Supabase
 */

// Load environment variables FIRST, before any imports that need them
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Now import modules that depend on environment variables
import { getAllTables, getTableSchema, getAllRecords } from '../lib/airtableClient';
import {
  ensureTableSchema,
  upsertRecords,
  supabaseAdmin,
} from '../lib/supabaseClient';

async function syncTable(tableId: string, tableName: string): Promise<void> {
  console.log(`\n📊 Syncing table: ${tableName} (${tableId})`);

  try {
    // Get table schema
    const fields = await getTableSchema(tableId);
    console.log(`   Found ${fields.length} fields`);

    // Ensure Supabase table exists with correct schema
    await ensureTableSchema(tableName, fields);
    console.log(`   ✓ Table schema ensured`);

    // Fetch all records
    console.log(`   Fetching records...`);
    const records = await getAllRecords(tableId);
    console.log(`   Found ${records.length} records`);

    // Upsert records
    if (records.length > 0) {
      console.log(`   Upserting records...`);
      await upsertRecords(tableName, records, fields);
      console.log(`   ✓ Synced ${records.length} records`);
    } else {
      console.log(`   ⚠ No records to sync`);
    }

    // Update last synced timestamp
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    await supabaseAdmin
      .from('_table_metadata')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('table_name', sanitizedTableName);

    console.log(`   ✅ Table ${tableName} synced successfully`);
  } catch (error) {
    console.error(`   ❌ Error syncing table ${tableName}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Airtable → Supabase sync...\n');

  try {
    // Check if metadata table exists, if not, provide SQL
    const { error: metadataCheckError } = await supabaseAdmin
      .from('_table_metadata')
      .select('table_name')
      .limit(1);

    if (metadataCheckError) {
      console.warn('\n⚠️  Metadata table does not exist.');
      console.warn('Please run this SQL in Supabase SQL Editor:\n');
      console.log(`
CREATE TABLE IF NOT EXISTS _table_metadata (
  table_name text PRIMARY KEY,
  display_name text NOT NULL,
  airtable_table_id text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_metadata_display_name ON _table_metadata(display_name);
      `.trim());
      console.warn('\nOr run: npm run generate-migration\n');
    }

    // Fetch all tables
    console.log('📋 Fetching tables from Airtable...');
    const tables = await getAllTables();
    console.log(`   Found ${tables.length} tables\n`);

    if (tables.length === 0) {
      console.log('⚠ No tables found in Airtable base');
      return;
    }

    // Sync each table
    for (const table of tables) {
      await syncTable(table.id, table.name);
    }

    console.log(`\n✅ Sync completed! Synced ${tables.length} tables`);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run sync
main();

