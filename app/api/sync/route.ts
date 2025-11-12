import { NextRequest, NextResponse } from 'next/server';
import { getAllTables, getTableSchema, getAllRecords } from '@/lib/airtableClient';
import {
  ensureTableSchema,
  upsertRecords,
  supabaseAdmin,
} from '@/lib/supabaseClient';

interface SyncProgress {
  currentTable: string;
  totalTables: number;
  completedTables: number;
  currentTableRecords: number;
  totalRecordsProcessed: number;
}

interface TableSyncResult {
  tableName: string;
  recordsFetched: number;
  recordsSynced: number;
  recordsBefore: number;
  recordsAfter: number;
  recordsAdded: number;
  recordsUpdated: number;
  error?: string;
}

interface SyncSummary {
  success: boolean;
  totalTables: number;
  completedTables: number;
  totalRecordsFetched: number;
  totalRecordsSynced: number;
  totalRecordsAdded: number;
  totalRecordsUpdated: number;
  tables: TableSyncResult[];
  error?: string;
}

async function syncTable(
  tableId: string,
  tableName: string
): Promise<TableSyncResult> {
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  try {
    // Get count before sync
    const { count: countBefore } = await supabaseAdmin
      .from(sanitizedTableName)
      .select('*', { count: 'exact', head: true })
      .eq('deleted', false);
    const recordsBefore = countBefore || 0;

    // Get table schema
    const fields = await getTableSchema(tableId);

    // Ensure Supabase table exists with correct schema
    await ensureTableSchema(tableName, fields, tableId);

    // Fetch all records
    const records = await getAllRecords(tableId);
    const recordsFetched = records.length;

    // Get existing airtable_ids to determine adds vs updates
    const { data: existingRecords } = await supabaseAdmin
      .from(sanitizedTableName)
      .select('airtable_id')
      .eq('deleted', false);
    
    const existingIds = new Set((existingRecords || []).map((r: any) => r.airtable_id));
    const newIds = new Set(records.map((r) => r.id));
    
    // Calculate adds and updates
    let recordsAdded = 0;
    let recordsUpdated = 0;
    
    records.forEach((record) => {
      if (existingIds.has(record.id)) {
        recordsUpdated++;
      } else {
        recordsAdded++;
      }
    });

    // Upsert records
    if (records.length > 0) {
      await upsertRecords(tableName, records, fields);
    }

    // Get count after sync
    const { count: countAfter } = await supabaseAdmin
      .from(sanitizedTableName)
      .select('*', { count: 'exact', head: true })
      .eq('deleted', false);
    const recordsAfter = countAfter || 0;

    // Update last synced timestamp
    await supabaseAdmin
      .from('_table_metadata')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('table_name', sanitizedTableName);

    return {
      tableName,
      recordsFetched,
      recordsSynced: records.length,
      recordsBefore,
      recordsAfter,
      recordsAdded,
      recordsUpdated,
    };
  } catch (error: any) {
    console.error(`Error syncing table ${tableName}:`, error);
    return {
      tableName,
      recordsFetched: 0,
      recordsSynced: 0,
      recordsBefore: 0,
      recordsAfter: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      error: error.message || 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if metadata table exists
    const { error: metadataCheckError } = await supabaseAdmin
      .from('_table_metadata')
      .select('table_name')
      .limit(1);

    if (metadataCheckError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Metadata table does not exist. Please run the migration first.',
        },
        { status: 500 }
      );
    }

    // Fetch all tables
    const tables = await getAllTables();

    if (tables.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tables found in Airtable base',
        },
        { status: 400 }
      );
    }

    // Sync each table
    const tableResults: TableSyncResult[] = [];
    let totalRecordsFetched = 0;
    let totalRecordsSynced = 0;
    let totalRecordsAdded = 0;
    let totalRecordsUpdated = 0;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const result = await syncTable(table.id, table.name);
      tableResults.push(result);

      totalRecordsFetched += result.recordsFetched;
      totalRecordsSynced += result.recordsSynced;
      totalRecordsAdded += result.recordsAdded;
      totalRecordsUpdated += result.recordsUpdated;
    }

    const summary: SyncSummary = {
      success: true,
      totalTables: tables.length,
      completedTables: tableResults.filter((r) => !r.error).length,
      totalRecordsFetched,
      totalRecordsSynced,
      totalRecordsAdded,
      totalRecordsUpdated,
      tables: tableResults,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Sync failed',
      },
      { status: 500 }
    );
  }
}

