'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { TableCard } from '@/components/TableCard';
import { supabase } from '@/lib/supabaseClient.client';
import { motion } from 'framer-motion';
import { RefreshIndicator } from '@/components/RefreshIndicator';

interface TableMetadata {
  table_name: string;
  display_name: string;
  last_synced_at: string | null;
  record_count?: number;
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);

  const fetchTables = async () => {
    try {
      console.log('🔄 fetchTables called at', new Date().toISOString());
      setLoading(true);
      
      const { data: metadata, error } = await supabase
        .from('_table_metadata')
        .select('*')
        .order('display_name');

      if (error) {
        console.error('❌ Error fetching tables:', error);
        setTables([]);
        setLoading(false);
        return;
      }

      console.log('📊 Fetched', metadata?.length || 0, 'tables from metadata');

      // Fetch record counts with fresh queries
      const tablesWithCounts = await Promise.all(
        (metadata || []).map(async (table) => {
          const { count, error: countError } = await supabase
            .from(table.table_name)
            .select('*', { count: 'exact', head: true })
            .eq('deleted', false);

          if (countError) {
            console.warn(`⚠️ Error counting records for ${table.table_name}:`, countError);
          }

          return {
            ...table,
            record_count: count || 0,
          };
        })
      );

      const totalRecords = tablesWithCounts.reduce((sum, table) => sum + (table.record_count || 0), 0);
      console.log('✅ Updated tables:', tablesWithCounts.length, 'tables with', totalRecords, 'total records');
      
      setTables(tablesWithCounts);
      setLastRefreshed(new Date());
      console.log('✅ Refresh completed at', new Date().toISOString());
    } catch (error) {
      console.error('❌ Error in fetchTables:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchTables();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  const filteredTables = tables.filter((table) =>
    table.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              All Tables
            </h2>
            <RefreshIndicator
              onRefresh={() => {
                console.log('🔄 Refresh button clicked in tables page');
                fetchTables();
              }}
              lastRefreshed={lastRefreshed || undefined}
            />
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search tables..."
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

        {tables.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No tables found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Run <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                npm run sync
              </code>{' '}
              to sync your Airtable base
            </p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No tables match your search
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTables.map((table, index) => (
              <motion.div
                key={table.table_name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <TableCard
                  tableName={table.display_name}
                  recordCount={table.record_count || 0}
                  lastSynced={table.last_synced_at || undefined}
                  href={`/tables/${table.table_name}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

