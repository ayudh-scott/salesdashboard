import { NextRequest, NextResponse } from 'next/server';
import {
  supabaseAdmin,
  ensureTableSchema,
  upsertRecords,
  markRecordDeleted,
} from '@/lib/supabaseClient';
import { getTableSchema, getRecord } from '@/lib/airtableClient';

/**
 * Webhook endpoint for Airtable automation updates
 * 
 * Expected payload format:
 * {
 *   "event": "create" | "update" | "delete",
 *   "tableId": "tblXXXXXXXXXXXX",
 *   "tableName": "Table Name",
 *   "recordId": "recXXXXXXXXXXXX",
 *   "secret": "WEBHOOK_SECRET"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const body = await request.json();
    const { secret, event, tableId, tableName, recordId } = body;

    if (!process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    if (!event || !tableId || !tableName) {
      return NextResponse.json(
        { error: 'Missing required fields: event, tableId, tableName' },
        { status: 400 }
      );
    }

    console.log(`📥 Webhook received: ${event} for table ${tableName} (${tableId})`);

    // Get table schema
    const fields = await getTableSchema(tableId);
    await ensureTableSchema(tableName, fields);

    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    // Handle different event types
    switch (event) {
      case 'create':
      case 'update':
        if (!recordId) {
          return NextResponse.json(
            { error: 'recordId required for create/update events' },
            { status: 400 }
          );
        }

        // Fetch record from Airtable
        const record = await getRecord(tableId, recordId);
        if (!record) {
          return NextResponse.json(
            { error: 'Record not found in Airtable' },
            { status: 404 }
          );
        }

        // Upsert into Supabase
        await upsertRecords(tableName, [record], fields);
        console.log(`   ✅ Record ${recordId} ${event}d`);

        return NextResponse.json({
          success: true,
          message: `Record ${event}d successfully`,
          recordId,
        });

      case 'delete':
        if (!recordId) {
          return NextResponse.json(
            { error: 'recordId required for delete events' },
            { status: 400 }
          );
        }

        // Mark as deleted in Supabase
        await markRecordDeleted(tableName, recordId);
        console.log(`   ✅ Record ${recordId} marked as deleted`);

        return NextResponse.json({
          success: true,
          message: 'Record marked as deleted',
          recordId,
        });

      default:
        return NextResponse.json(
          { error: `Unknown event type: ${event}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint is active',
  });
}

