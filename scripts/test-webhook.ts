#!/usr/bin/env tsx

/**
 * Test script to simulate Airtable webhook payloads
 * Usage: tsx scripts/test-webhook.ts [event] [tableId] [tableName] [recordId]
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'supersecretstring';

async function testWebhook(
  event: 'create' | 'update' | 'delete',
  tableId: string,
  tableName: string,
  recordId?: string
) {
  const payload = {
    event,
    tableId,
    tableName,
    recordId: recordId || `rec${Math.random().toString(36).substring(7)}`,
    secret: WEBHOOK_SECRET,
  };

  console.log(`\n📤 Sending ${event} webhook for table: ${tableName}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook successful:', data);
    } else {
      console.error('❌ Webhook failed:', data);
    }
  } catch (error) {
    console.error('❌ Error sending webhook:', error);
  }
}

// Parse command line arguments
const [event, tableId, tableName, recordId] = process.argv.slice(2);

if (!event || !tableId || !tableName) {
  console.log(`
Usage: tsx scripts/test-webhook.ts <event> <tableId> <tableName> [recordId]

Examples:
  tsx scripts/test-webhook.ts create tblXXXXXXXXXXXX "My Table" recXXXXXXXXXXXX
  tsx scripts/test-webhook.ts update tblXXXXXXXXXXXX "My Table" recXXXXXXXXXXXX
  tsx scripts/test-webhook.ts delete tblXXXXXXXXXXXX "My Table" recXXXXXXXXXXXX
  `);
  process.exit(1);
}

if (!['create', 'update', 'delete'].includes(event)) {
  console.error('Error: event must be one of: create, update, delete');
  process.exit(1);
}

testWebhook(event as 'create' | 'update' | 'delete', tableId, tableName, recordId);

