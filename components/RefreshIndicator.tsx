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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('Refresh button clicked, calling onRefresh...');
      await onRefresh();
      console.log('Refresh completed');
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
      {lastRefreshed && (
        <span className="text-xs sm:text-sm">Last refreshed: {timeSinceRefresh}</span>
      )}
      {onRefresh && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          aria-label="Refresh data"
          title="Refresh data"
        >
          <svg
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
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
          <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      )}
    </div>
  );
}

