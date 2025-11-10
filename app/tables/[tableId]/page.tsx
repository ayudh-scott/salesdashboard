'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient.client';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshIndicator } from '@/components/RefreshIndicator';

interface TableRecord {
  id: string;
  airtable_id: string;
  raw_json: { [key: string]: any };
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export default function TableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const [records, setRecords] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<TableRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableName, setTableName] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);

  const fetchRecords = async () => {
    try {
      console.log('Fetching fresh records for table:', tableId);
      const { data, error } = await supabase
        .from(tableId)
        .select('*')
        .eq('deleted', false)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching records:', error);
        return;
      }

      setRecords(data || []);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Get table metadata with fresh query
      console.log('Fetching fresh data for table:', tableId);
      const { data: metadata } = await supabase
        .from('_table_metadata')
        .select('display_name')
        .eq('table_name', tableId)
        .single();

      if (metadata) {
        setTableName(metadata.display_name);
      }

      await fetchRecords();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let channel: any;

    async function initData() {
      try {
        setLoading(true);
        // Get table metadata
        const { data: metadata } = await supabase
          .from('_table_metadata')
          .select('display_name')
          .eq('table_name', tableId)
          .single();

        if (metadata) {
          setTableName(metadata.display_name);
        }

        // Subscribe to realtime updates
        channel = supabase
          .channel(`table-${tableId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: tableId,
            },
            (payload) => {
              console.log('Realtime update:', payload);
              // Refetch records on update
              fetchRecords();
            }
          )
          .subscribe();

        await fetchRecords();
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    initData();

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => {
      clearInterval(refreshInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tableId]);

  const filteredRecords = records.filter((record) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return JSON.stringify(record.raw_json).toLowerCase().includes(searchLower);
  });

  // Get all unique field names from records (computed once)
  const allFields = new Set<string>();
  filteredRecords.forEach((record) => {
    Object.keys(record.raw_json || {}).forEach((key) => {
      allFields.add(key);
    });
  });
  const fieldArray = Array.from(allFields).slice(0, 15); // Show first 15 fields

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {tableName || tableId}
            </h2>
            <RefreshIndicator
              onRefresh={fetchData}
              lastRefreshed={lastRefreshed || undefined}
            />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </p>

          {/* Search */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </motion.div>

        {/* Records Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">
                      #
                    </th>
                    {fieldArray.map((field) => (
                      <th
                        key={field}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                      >
                        {field}
                      </th>
                    ))}
                    {allFields.size > fieldArray.length && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        ... (+{allFields.size - fieldArray.length} more)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRecords.map((record, index) => (
                    <motion.tr
                      key={record.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.01 }}
                      onClick={() => setSelectedRecord(record)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                        {index + 1}
                      </td>
                      {fieldArray.map((field) => {
                        const value = record.raw_json?.[field];
                        const displayValue =
                          value === null || value === undefined
                            ? '-'
                            : typeof value === 'object'
                            ? JSON.stringify(value).slice(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '')
                            : String(value).length > 100
                            ? String(value).slice(0, 100) + '...'
                            : String(value);
                        
                        return (
                          <td
                            key={field}
                            className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap"
                          >
                            <div className="max-w-xs truncate" title={String(value)}>
                              {displayValue}
                            </div>
                          </td>
                        );
                      })}
                      {allFields.size > fieldArray.length && (
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          Click to view all
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Record Detail Modal */}
        <AnimatePresence>
          {selectedRecord && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedRecord(null)}
                className="fixed inset-0 bg-black/50 z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-2xl md:max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Record Details
                  </h3>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <svg
                      className="w-5 h-5 text-gray-600 dark:text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  <pre className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedRecord.raw_json, null, 2)}
                  </pre>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}

