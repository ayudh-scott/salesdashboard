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

export default function Home() {
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);

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
                Run <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  npm run sync
                </code>{' '}
                to sync your Airtable base
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

