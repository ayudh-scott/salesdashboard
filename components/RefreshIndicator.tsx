'use client';

import { useState, useEffect } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface RefreshIndicatorProps {
  onRefresh?: () => void;
  lastRefreshed?: Date;
}

export function RefreshIndicator({ onRefresh, lastRefreshed }: RefreshIndicatorProps) {
  const [timeSinceRefresh, setTimeSinceRefresh] = useState<string>('');

  useEffect(() => {
    if (!lastRefreshed) return;

    const updateTime = () => {
      setTimeSinceRefresh(formatRelativeTime(lastRefreshed));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(interval);
  }, [lastRefreshed]);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      {lastRefreshed && (
        <span>Last refreshed: {timeSinceRefresh}</span>
      )}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Refresh data"
          title="Refresh data"
        >
          <svg
            className="w-4 h-4 text-gray-600 dark:text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

