'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient.client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import { RefreshIndicator } from '@/components/RefreshIndicator';

interface TableMetadata {
  table_name: string;
  display_name: string;
  last_synced_at: string | null;
  record_count?: number;
}

interface SyncSummary {
  success: boolean;
  totalTables: number;
  completedTables: number;
  totalRecordsFetched: number;
  totalRecordsSynced: number;
  totalRecordsAdded: number;
  totalRecordsUpdated: number;
  tables: Array<{
    tableName: string;
    recordsFetched: number;
    recordsSynced: number;
    recordsBefore: number;
    recordsAfter: number;
    recordsAdded: number;
    recordsUpdated: number;
    error?: string;
  }>;
  error?: string;
}

export default function Home() {
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>('');
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch table metadata with cache busting
      const cacheBuster = `?t=${Date.now()}`;
      const { data: metadata, error: metadataError } = await supabase
        .from('_table_metadata')
        .select('*')
        .order('display_name');

      if (metadataError) {
        console.error('Error fetching metadata:', metadataError);
        // If metadata table doesn't exist, show empty state
        setTables([]);
        setLoading(false);
        return;
      }

      // Fetch record counts for each table with fresh queries
      const tablesWithCounts = await Promise.all(
        (metadata || []).map(async (table) => {
          const { count, error } = await supabase
            .from(table.table_name)
            .select('*', { count: 'exact', head: true })
            .eq('deleted', false);

          return {
            ...table,
            record_count: count || 0,
          };
        })
      );

      console.log('Fetched', tablesWithCounts.length, 'tables with', 
        tablesWithCounts.reduce((sum, table) => sum + (table.record_count || 0), 0), 
        'total records');
      setTables(tablesWithCounts);
      setTotalRecords(
        tablesWithCounts.reduce((sum, table) => sum + (table.record_count || 0), 0)
      );
      setLastRefreshed(new Date());
      console.log('Data refresh completed at', new Date().toISOString());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncProgress('Starting sync...');
      setSyncSummary(null);

      const response = await fetch('/api/sync', {
        method: 'POST',
      });

      const summary: SyncSummary = await response.json();

      if (!response.ok || !summary.success) {
        throw new Error(summary.error || 'Sync failed');
      }

      setSyncSummary(summary);
      setSyncProgress('Sync completed!');

      // Refresh data after sync
      await fetchData();
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncSummary({
        success: false,
        totalTables: 0,
        completedTables: 0,
        totalRecordsFetched: 0,
        totalRecordsSynced: 0,
        totalRecordsAdded: 0,
        totalRecordsUpdated: 0,
        tables: [],
        error: error.message || 'Sync failed',
      });
      setSyncProgress('Sync failed');
    } finally {
      setIsSyncing(false);
      // Clear progress message after 3 seconds
      setTimeout(() => {
        setSyncProgress('');
      }, 3000);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

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

  const lastSynced = tables
    .map((t) => t.last_synced_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Dashboard Overview
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Real-time data synced from Airtable
                </p>
                <div className="mt-2">
                  <RefreshIndicator
                    onRefresh={fetchData}
                    lastRefreshed={lastRefreshed || undefined}
                  />
                </div>
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {isSyncing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4z"
                      />
                    </svg>
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Sync All Tables</span>
                  </>
                )}
              </button>
            </div>
            {syncProgress && (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                {syncProgress}
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-3xl mb-2">📊</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {tables.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Tables</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-3xl mb-2">📝</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalRecords.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Records</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-3xl mb-2">🔄</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {lastSynced ? formatRelativeTime(lastSynced) : 'Never'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Last Synced</div>
          </motion.div>
        </div>

        {/* Sync Summary */}
        {syncSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-8 rounded-xl shadow-sm border p-6 ${
              syncSummary.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {syncSummary.success ? '✅ Sync Completed' : '❌ Sync Failed'}
              </h3>
              <button
                onClick={() => setSyncSummary(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {syncSummary.success ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tables Synced</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncSummary.completedTables} / {syncSummary.totalTables}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Records Fetched</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncSummary.totalRecordsFetched.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Records Added</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      +{syncSummary.totalRecordsAdded.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Records Updated</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {syncSummary.totalRecordsUpdated.toLocaleString()}
                    </div>
                  </div>
                </div>
                {syncSummary.tables.length > 0 && (
                  <div className="mt-4">
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                        View table details ({syncSummary.tables.length} tables)
                      </summary>
                      <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                        {syncSummary.tables.map((table) => (
                          <div
                            key={table.tableName}
                            className="text-sm bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                          >
                            <div className="font-medium text-gray-900 dark:text-white mb-1">
                              {table.tableName}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <div>Fetched: {table.recordsFetched}</div>
                              <div>Added: <span className="text-green-600 dark:text-green-400">+{table.recordsAdded}</span></div>
                              <div>Updated: <span className="text-blue-600 dark:text-blue-400">{table.recordsUpdated}</span></div>
                              <div>Total: {table.recordsAfter}</div>
                            </div>
                            {table.error && (
                              <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                Error: {table.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                {syncSummary.error || 'Sync failed'}
              </div>
            )}
          </motion.div>
        )}

        {/* Quick Access Tables */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Tables
            </h3>
            <Link
              href="/tables"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all →
            </Link>
          </div>

          {tables.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No tables synced yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Click the <strong>"Sync All Tables"</strong> button above to sync your Airtable base
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.slice(0, 6).map((table, index) => (
                <Link key={table.table_name} href={`/tables/${table.table_name}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {table.display_name}
                      </h4>
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {table.record_count || 0} records
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </main>
      <BottomNav />
    </div>
  );
}

