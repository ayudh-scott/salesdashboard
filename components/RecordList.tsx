'use client';

import { motion } from 'framer-motion';
import { formatDate } from '@/lib/utils';

interface TableRecord {
  id: string;
  airtable_id: string;
  raw_json: { [key: string]: any };
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

interface RecordListProps {
  records: TableRecord[];
  onRecordClick?: (record: TableRecord) => void;
}

export function RecordList({ records, onRecordClick }: RecordListProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No records found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record, index) => (
        <motion.div
          key={record.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onRecordClick?.(record)}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(record.raw_json || {})
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
                    >
                      <span className="font-medium text-gray-600 dark:text-gray-400">
                        {key}:
                      </span>{' '}
                      <span className="text-gray-900 dark:text-white">
                        {typeof value === 'object'
                          ? JSON.stringify(value).slice(0, 50)
                          : String(value).slice(0, 50)}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Updated {formatDate(record.updated_at)}
              </div>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-600">
              {record.airtable_id.slice(0, 8)}...
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

