'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatRelativeTime } from '@/lib/utils';

interface TableCardProps {
  tableName: string;
  recordCount: number;
  lastSynced?: string;
  href: string;
}

export function TableCard({ tableName, recordCount, lastSynced, href }: TableCardProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 p-6 cursor-pointer transition-shadow"
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tableName}
          </h3>
          <span className="text-2xl">📊</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{recordCount}</span>
            <span>records</span>
          </div>
          {lastSynced && (
            <div className="text-xs text-gray-500 dark:text-gray-500">
              Synced {formatRelativeTime(lastSynced)}
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

