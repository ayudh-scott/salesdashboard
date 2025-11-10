#!/usr/bin/env tsx

/**
 * Generate SQL migration file for all Airtable tables
 * This script fetches all tables from Airtable and generates SQL to create them in Supabase
 */

// Load environment variables FIRST, before any imports that need them
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Now import modules that depend on environment variables
import { getAllTables, getTableSchema } from '../lib/airtableClient';
import { generateTableSQL } from '../lib/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Generating SQL migration for Airtable tables...\n');

  try {
    // Create metadata table SQL
    const metadataTableSQL = `
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
    `.trim();

    // Fetch all tables
    console.log('📋 Fetching tables from Airtable...');
    const tables = await getAllTables();
    console.log(`   Found ${tables.length} tables\n`);

    if (tables.length === 0) {
      console.log('⚠ No tables found in Airtable base');
      return;
    }

    // Generate SQL for each table
    const allSQL: string[] = [metadataTableSQL, ''];
    
    for (const table of tables) {
      console.log(`   Processing: ${table.name}...`);
      try {
        const fields = await getTableSchema(table.id);
        const sql = generateTableSQL(table.name, fields);
        allSQL.push(`-- Table: ${table.name}`);
        allSQL.push(sql);
        allSQL.push('');
      } catch (error) {
        console.error(`   ❌ Error processing ${table.name}:`, error);
      }
    }

    // Write to file
    const migrationSQL = allSQL.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `migration-${timestamp}.sql`;
    const filepath = path.join(process.cwd(), filename);

    fs.writeFileSync(filepath, migrationSQL);
    console.log(`\n✅ Migration file generated: ${filename}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review the SQL in ${filename}`);
    console.log(`   2. Run it in Supabase SQL Editor (Dashboard > SQL Editor)`);
    console.log(`   3. Then run: npm run sync\n`);
  } catch (error) {
    console.error('\n❌ Migration generation failed:', error);
    process.exit(1);
  }
}

main();

