import Airtable from 'airtable';

// Lazy initialization - only create base when needed
let baseInstance: Airtable.Base | null = null;

function getBase(): Airtable.Base {
  if (!process.env.AIRTABLE_PAT) {
    throw new Error('AIRTABLE_PAT is not set');
  }

  if (!process.env.AIRTABLE_BASE_ID) {
    throw new Error('AIRTABLE_BASE_ID is not set');
  }

  if (!baseInstance) {
    baseInstance = new Airtable({
      apiKey: process.env.AIRTABLE_PAT,
    }).base(process.env.AIRTABLE_BASE_ID);
  }

  return baseInstance;
}

// Export base for backward compatibility (but it will be initialized lazily)
// Simple wrapper that provides table access
const base = {
  get(tableName: string) {
    return getBase()(tableName);
  },
} as any;

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: any;
}

export interface AirtableTable {
  id: string;
  name: string;
  description?: string;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

/**
 * Fetch all tables from the Airtable base
 * Uses Airtable REST API to get base metadata
 */
export async function getAllTables(): Promise<AirtableTable[]> {
  try {
    if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials not configured');
    }

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.tables.map((table: any) => ({
      id: table.id,
      name: table.name,
      description: table.description,
    }));
  } catch (error) {
    console.error('Error fetching tables:', error);
    throw error;
  }
}

/**
 * Get table schema (fields)
 */
export async function getTableSchema(tableId: string): Promise<AirtableField[]> {
  try {
    if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials not configured');
    }

    // Fetch all tables and find the one we need
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const table = data.tables.find((t: any) => t.id === tableId);
    
    if (!table) {
      throw new Error(`Table ${tableId} not found`);
    }

    return table.fields.map((field: any) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      options: field.options,
    }));
  } catch (error) {
    console.error(`Error fetching schema for table ${tableId}:`, error);
    throw error;
  }
}

/**
 * Fetch all records from a table (handles pagination)
 */
export async function getAllRecords(
  tableId: string,
  view?: string
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  try {
    const actualBase = getBase();
    do {
      const selectOptions: any = {
        pageSize: 100,
      };
      
      // Only include view if it's provided
      if (view) {
        selectOptions.view = view;
      }
      
      // Only include offset if it exists
      if (offset) {
        selectOptions.offset = offset;
      }
      
      const page = await actualBase(tableId)
        .select(selectOptions)
        .all();

      page.forEach((record) => {
        records.push({
          id: record.id,
          fields: record.fields,
          createdTime: record._rawJson.createdTime,
        });
      });

      offset = page.length === 100 ? page[page.length - 1].id : undefined;
    } while (offset);

    return records;
  } catch (error) {
    console.error(`Error fetching records from table ${tableId}:`, error);
    throw error;
  }
}

/**
 * Get a single record by ID
 */
export async function getRecord(
  tableId: string,
  recordId: string
): Promise<AirtableRecord | null> {
  try {
    const actualBase = getBase();
    const record = await actualBase(tableId).find(recordId);
    return {
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson.createdTime,
    };
  } catch (error) {
    console.error(`Error fetching record ${recordId} from table ${tableId}:`, error);
    return null;
  }
}

export { base };

