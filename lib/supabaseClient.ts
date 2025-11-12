import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sanitizeNumeric } from './utils';

// Lazy initialization - only create clients when needed
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is not set');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdminInstance;
}

// Export supabaseAdmin with lazy initialization
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop];
  },
}) as SupabaseClient;

// Note: For client-side usage, import from '@/lib/supabaseClient.client' instead
// This export is kept for backward compatibility but should not be used in client components

/**
 * Convert Airtable field type to PostgreSQL type
 */
export function airtableTypeToPgType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    singleLineText: 'text',
    multilineText: 'text',
    email: 'text',
    url: 'text',
    phoneNumber: 'text',
    number: 'numeric',
    percent: 'numeric',
    currency: 'numeric',
    singleSelect: 'text',
    multipleSelects: 'text[]',
    date: 'timestamp with time zone',
    dateTime: 'timestamp with time zone',
    checkbox: 'boolean',
    multipleRecordLinks: 'text[]',
    singleCollaborator: 'text',
    multipleCollaborators: 'text[]',
    attachment: 'text[]',
    formula: 'text',
    rollup: 'text',
    lookup: 'text',
    count: 'integer',
    duration: 'numeric',
    rating: 'integer',
    button: 'text',
    createdTime: 'timestamp with time zone',
    lastModifiedTime: 'timestamp with time zone',
  };

  return typeMap[fieldType] || 'text';
}

/**
 * Convert Airtable field value to PostgreSQL-compatible value
 */
export function convertFieldValue(value: any, fieldType: string): any {
  if (value === null || value === undefined) {
    return null;
  }

  switch (fieldType) {
    case 'attachment':
      // Store attachment URLs as array
      if (Array.isArray(value)) {
        return value.map((att: any) => att.url || att.thumbnails?.large?.url || '');
      }
      return [];
    case 'multipleRecordLinks':
      // Store linked record IDs as array
      if (Array.isArray(value)) {
        return value;
      }
      return [];
    case 'multipleSelects':
      if (Array.isArray(value)) {
        return value;
      }
      return [];
    case 'date':
    case 'dateTime':
      return value ? new Date(value).toISOString() : null;
    case 'checkbox':
      return Boolean(value);
    case 'number':
    case 'percent':
    case 'currency':
      return sanitizeNumeric(value);
    default:
      return value;
  }
}

/**
 * Generate SQL for creating a Supabase table based on Airtable fields
 */
export function generateTableSQL(
  tableName: string,
  fields: Array<{ id: string; name: string; type: string }>
): string {
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  const columns = [
    'id uuid PRIMARY KEY DEFAULT gen_random_uuid()',
    'airtable_id text UNIQUE NOT NULL',
    'raw_json jsonb NOT NULL',
    'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()',
    'deleted boolean DEFAULT false',
  ];

  // Reserved column names that we use for our schema
  const reservedNames = new Set(['id', 'airtable_id', 'raw_json', 'created_at', 'updated_at', 'deleted']);

  // Add columns for each field
  fields.forEach((field) => {
    let sanitizedFieldName = field.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    
    // If field name conflicts with reserved names, prefix it
    if (reservedNames.has(sanitizedFieldName)) {
      sanitizedFieldName = `airtable_field_${sanitizedFieldName}`;
    }
    
    const pgType = airtableTypeToPgType(field.type);
    columns.push(`${sanitizedFieldName} ${pgType}`);
  });

  return `
-- Create table: ${tableName}
CREATE TABLE IF NOT EXISTS ${sanitizedTableName} (
  ${columns.join(',\n  ')}
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ${sanitizedTableName};

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_${sanitizedTableName}_airtable_id ON ${sanitizedTableName}(airtable_id);
CREATE INDEX IF NOT EXISTS idx_${sanitizedTableName}_deleted ON ${sanitizedTableName}(deleted);

-- Insert/update metadata
INSERT INTO _table_metadata (table_name, display_name, airtable_table_id, last_synced_at)
VALUES ('${sanitizedTableName}', '${tableName.replace(/'/g, "''")}', '${tableName}', now())
ON CONFLICT (table_name) 
DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  last_synced_at = EXCLUDED.last_synced_at;
  `.trim();
}

/**
 * Create or update Supabase table schema based on Airtable fields
 * Note: This function generates SQL that should be run in Supabase SQL Editor
 * or via a migration. Tables are created automatically during sync if they don't exist.
 */
export async function ensureTableSchema(
  tableName: string,
  fields: Array<{ id: string; name: string; type: string }>,
  airtableTableId?: string
): Promise<void> {
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  // Check if table exists by trying to query it
  const { error: tableCheckError } = await supabaseAdmin
    .from(sanitizedTableName)
    .select('id')
    .limit(1);

  if (tableCheckError) {
    // Table doesn't exist - generate SQL for manual creation
    const sql = generateTableSQL(tableName, fields);
    console.warn(`\n⚠️  Table "${sanitizedTableName}" does not exist.`);
    console.warn('Please run this SQL in Supabase SQL Editor:\n');
    console.log(sql);
    console.warn('\nAlternatively, tables will be created automatically if you run the SQL migration script.\n');
    throw new Error(`Table ${sanitizedTableName} does not exist. Please create it first.`);
  }

  // Update metadata
  await supabaseAdmin
    .from('_table_metadata')
    .upsert({
      table_name: sanitizedTableName,
      display_name: tableName,
      airtable_table_id: airtableTableId || tableName, // Use actual Airtable table ID if provided
      last_synced_at: new Date().toISOString(),
    });
}

/**
 * Upsert records into Supabase table
 */
export async function upsertRecords(
  tableName: string,
  records: Array<{
    id: string;
    fields: Record<string, any>;
    createdTime: string;
  }>,
  fieldSchema: Array<{ id: string; name: string; type: string }>
): Promise<void> {
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  // Reserved column names that we use for our schema
  const reservedNames = new Set(['id', 'airtable_id', 'raw_json', 'created_at', 'updated_at', 'deleted']);

  const recordsToInsert = records.map((record) => {
    const row: Record<string, any> = {
      airtable_id: record.id,
      raw_json: record.fields,
      updated_at: new Date().toISOString(),
      deleted: false,
    };

    // Map each field
    fieldSchema.forEach((field) => {
      let sanitizedFieldName = field.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      // If field name conflicts with reserved names, prefix it
      if (reservedNames.has(sanitizedFieldName)) {
        sanitizedFieldName = `airtable_field_${sanitizedFieldName}`;
      }
      
      const value = record.fields[field.name];
      row[sanitizedFieldName] = convertFieldValue(value, field.type);
    });

    return row;
  });

  // Upsert in batches
  const batchSize = 100;
  for (let i = 0; i < recordsToInsert.length; i += batchSize) {
    const batch = recordsToInsert.slice(i, i + batchSize);
    const { error } = await supabaseAdmin
      .from(sanitizedTableName)
      .upsert(batch, {
        onConflict: 'airtable_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`Error upserting batch ${i / batchSize + 1}:`, error);
      throw error;
    }
  }
}

/**
 * Mark record as deleted
 */
export async function markRecordDeleted(
  tableName: string,
  airtableId: string
): Promise<void> {
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  const { error } = await supabaseAdmin
    .from(sanitizedTableName)
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('airtable_id', airtableId);

  if (error) {
    console.error(`Error marking record as deleted:`, error);
    throw error;
  }
}

