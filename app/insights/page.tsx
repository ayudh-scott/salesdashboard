'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient.client';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatDate, formatINR, formatINRCompact, sanitizeNumeric } from '@/lib/utils';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import React from 'react';

interface TableMetadata {
  table_name: string;
  display_name: string;
  last_synced_at: string | null;
  record_count?: number;
  airtable_table_id?: string | null;
}

interface SalesData {
  date: string;
  sales: number;
}

interface CoordinatorSales {
  coordinator: string;
  sales: number;
}

interface GrowthMetrics {
  dod: number;
  wow: number;
  mom: number;
  yoy: number;
}

interface SalesCoordinatorMapping {
  id: string;
  name: string;
  avatar_url: string | null;
  source_names: string[];
}

export default function InsightsPage() {
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Date filter state
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('7d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Sales data state
  const [rmpTotalSales, setRmpTotalSales] = useState(0);
  const [orderReportTotalSales, setOrderReportTotalSales] = useState(0);
  const [rmpDailySales, setRmpDailySales] = useState<SalesData[]>([]);
  const [orderReportDailySales, setOrderReportDailySales] = useState<SalesData[]>([]);
  const [rmpCoordinatorSales, setRmpCoordinatorSales] = useState<CoordinatorSales[]>([]);
  const [orderReportCoordinatorSales, setOrderReportCoordinatorSales] = useState<CoordinatorSales[]>([]);
  const [rmpCoordinatorTable, setRmpCoordinatorTable] = useState<any[]>([]);
  const [orderReportCoordinatorTable, setOrderReportCoordinatorTable] = useState<any[]>([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'coordinator' | 'date'>('all');
  const [rmpCoordinatorCustomers, setRmpCoordinatorCustomers] = useState<Map<string, Array<{customer: string; sales: number}>>>(new Map());
  const [orderReportCoordinatorCustomers, setOrderReportCoordinatorCustomers] = useState<Map<string, Array<{customer: string; sales: number}>>>(new Map());
  const [coordinatorMappings, setCoordinatorMappings] = useState<SalesCoordinatorMapping[]>([]);
  const [coordinatorLookup, setCoordinatorLookup] = useState<Record<string, { name: string; avatar_url?: string | null }>>({});
  const [availableCoordinators, setAvailableCoordinators] = useState<string[]>([]);
  const [showCoordinatorForm, setShowCoordinatorForm] = useState(false);
  const [newCoordinatorName, setNewCoordinatorName] = useState('');
  const [newCoordinatorAvatar, setNewCoordinatorAvatar] = useState('');
  const [selectedSourceCoordinators, setSelectedSourceCoordinators] = useState<string[]>([]);
  const [isSavingCoordinator, setIsSavingCoordinator] = useState(false);
  const [coordinatorFormError, setCoordinatorFormError] = useState<string | null>(null);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetrics>({
    dod: 0,
    wow: 0,
    mom: 0,
    yoy: 0,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const normalizeCoordinatorName = (name: string | null | undefined) =>
    (name ?? '').trim().toLowerCase();

  const buildCoordinatorLookup = (rows: SalesCoordinatorMapping[]) => {
    const lookup: Record<string, { name: string; avatar_url?: string | null }> = {};
    rows.forEach((row) => {
      (row.source_names || []).forEach((source) => {
        const normalized = normalizeCoordinatorName(source);
        if (normalized) {
          lookup[normalized] = { name: row.name, avatar_url: row.avatar_url };
        }
      });
    });
    return lookup;
  };

  const fetchCoordinatorMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_coordinator')
        .select('id, name, avatar_url, source_names')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching coordinator mappings:', error);
        return { data: [] as SalesCoordinatorMapping[], lookup: {} as Record<string, { name: string; avatar_url?: string | null }> };
      }

      const rows = (data || []) as SalesCoordinatorMapping[];
      const lookup = buildCoordinatorLookup(rows);
      setCoordinatorMappings(rows);
      setCoordinatorLookup(lookup);
      return { data: rows, lookup };
    } catch (error) {
      console.error('Unexpected error fetching coordinator mappings:', error);
      return { data: [] as SalesCoordinatorMapping[], lookup: {} as Record<string, { name: string; avatar_url?: string | null }> };
    }
  };

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      // Fetch metadata
      const { data: metadata, error } = await supabase
        .from('_table_metadata')
        .select('*')
        .order('display_name');

      if (error) {
        console.error('Error fetching metadata:', error);
        setTables([]);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const tablesWithCounts = await Promise.all(
        (metadata || []).map(async (table) => {
          const { count } = await supabase
            .from(table.table_name)
            .select('*', { count: 'exact', head: true })
            .eq('deleted', false);

          return {
            ...table,
            record_count: count || 0,
          };
        })
      );

      setTables(tablesWithCounts);
      setTotalRecords(
        tablesWithCounts.reduce((sum, table) => sum + (table.record_count || 0), 0)
      );

      const { lookup } = await fetchCoordinatorMappings();

      // Fetch sales data using latest metadata
      await fetchSalesData(tablesWithCounts, lookup);
      
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  async function fetchSalesData(
    metadataTables?: TableMetadata[],
    lookupOverride?: Record<string, { name: string; avatar_url?: string | null }>
  ) {
      try {
        const metaSource = metadataTables ?? tables;
        const customTableMeta =
          metaSource.find(
            (t) =>
              t.airtable_table_id === 'tblBVElp9bCASGHow' ||
              t.display_name?.toLowerCase() === 'custom report' ||
              t.display_name?.toLowerCase() === 'order report' ||
              t.table_name === 'order_report'
          ) ?? null;
        const customTableName = customTableMeta?.table_name || 'order_report';
        console.log('🔍 Custom Report table lookup:', {
          found: customTableMeta ? 'yes' : 'no',
          tableName: customTableName,
          metadata: customTableMeta ? {
            table_name: customTableMeta.table_name,
            display_name: customTableMeta.display_name,
            airtable_table_id: customTableMeta.airtable_table_id
          } : null
        });
        const lookup = lookupOverride ?? coordinatorLookup;

        // Calculate date range
        const end = new Date();
        const start = new Date();
        
        if (dateRange === '7d') {
          start.setDate(start.getDate() - 7);
        } else if (dateRange === '30d') {
          start.setDate(start.getDate() - 30);
        } else if (dateRange === '90d') {
          start.setDate(start.getDate() - 90);
        } else if (dateRange === 'custom' && startDate && endDate) {
          start.setTime(new Date(startDate).getTime());
          end.setTime(new Date(endDate).getTime());
        } else {
          // Default to 7 days
          start.setDate(start.getDate() - 7);
        }

        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];

        // Fetch RMP Orders data with fresh query
        console.log('Fetching fresh RMP Orders data from', startDateStr, 'to', endDateStr);
        const { data: rmpOrders, error: rmpError } = await supabase
          .from('rmp_orders')
          .select('order_date, total_amount, sales_coordinator, customer_name, raw_json')
          .eq('deleted', false)
          .not('order_date', 'is', null)
          .gte('order_date', startDateStr)
          .lte('order_date', endDateStr)
          .order('order_date', { ascending: true })
          .limit(50000); // Increased limit to handle large date ranges

        if (rmpError) {
          console.error('Error fetching RMP orders:', rmpError);
        }

        // Fetch Custom Report data with fresh query
        console.log('Fetching fresh Custom Report data from', startDateStr, 'to', endDateStr, 'using table', customTableName);
        const { data: orderReports, error: orderError } = await supabase
          .from(customTableName)
          .select('order_date, total_sales__including_gst_, sales_value__ex_taxes_, key_account_manager__kam_, customer_name, raw_json')
          .eq('deleted', false)
          .not('order_date', 'is', null)
          .gte('order_date', startDateStr)
          .lte('order_date', endDateStr)
          .order('order_date', { ascending: true })
          .limit(50000); // Increased limit to handle large date ranges

        if (orderError) {
          console.error('Error fetching order reports:', orderError);
        }

      // Process sales data separately
      console.log('📊 Data fetch summary:', {
        rmpOrders: rmpOrders?.length || 0,
        orderReports: orderReports?.length || 0,
        dateRange: `${startDateStr} to ${endDateStr}`,
        customTableName
      });
      if (orderError) {
        console.error('❌ Custom Report query error:', orderError);
      }
      if (rmpError) {
        console.error('❌ RMP Orders query error:', rmpError);
      }
      processSalesData(rmpOrders || [], orderReports || [], lookup);
      console.log('✅ Sales data processing completed');
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  }

  const toggleSourceCoordinator = (coordinator: string) => {
    setSelectedSourceCoordinators((prev) =>
      prev.includes(coordinator)
        ? prev.filter((item) => item !== coordinator)
        : [...prev, coordinator]
    );
  };

  const handleAddCoordinator = async () => {
    setCoordinatorFormError(null);
    const trimmedName = newCoordinatorName.trim();
    const trimmedAvatar = newCoordinatorAvatar.trim();

    if (!trimmedName) {
      setCoordinatorFormError('Please enter a display name.');
      return;
    }

    if (selectedSourceCoordinators.length === 0) {
      setCoordinatorFormError('Select at least one existing coordinator to map.');
      return;
    }

    setIsSavingCoordinator(true);
    try {
      const { error } = await supabase.from('sales_coordinator').insert({
        name: trimmedName,
        avatar_url: trimmedAvatar || null,
        source_names: selectedSourceCoordinators,
      });

      if (error) {
        throw error;
      }

      const { lookup } = await fetchCoordinatorMappings();
      await fetchSalesData(tables, lookup);

      setShowCoordinatorForm(false);
      setNewCoordinatorName('');
      setNewCoordinatorAvatar('');
      setSelectedSourceCoordinators([]);
    } catch (error: any) {
      console.error('Error creating coordinator mapping:', error);
      setCoordinatorFormError(error?.message || 'Failed to create coordinator mapping.');
    } finally {
      setIsSavingCoordinator(false);
    }
  };

  function processSalesData(
    rmpOrders: any[],
    orderReports: any[],
    lookup: Record<string, { name: string; avatar_url?: string | null }>
  ) {
      console.log('🔄 Processing sales data:', {
        rmpOrdersCount: rmpOrders.length,
        orderReportsCount: orderReports.length
      });
      
      // Process RMP Orders separately
      const rmpSalesByDate = new Map<string, number>();
      const rmpSalesByCoordinator = new Map<string, number>();
      const rmpTableData: any[] = [];
      const rmpCustomersByCoordinator = new Map<string, Map<string, number>>();
      let rmpTotal = 0;
      const rawCoordinatorNames = new Set<string>();
      let rmpSkippedNoDate = 0;
      let rmpSkippedNoAmount = 0;

      rmpOrders.forEach((order) => {
        const date = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : null;
        if (!date) {
          rmpSkippedNoDate++;
          return;
        }

        const amountCandidates = [
          sanitizeNumeric((order as any).total_amount),
          sanitizeNumeric((order as any).amount),
          sanitizeNumeric(order.raw_json?.total_amount),
          sanitizeNumeric(order.raw_json?.amount),
        ];

        const amount = amountCandidates.find((val) => val !== 0) ?? 0;
        
        if (amount > 0) {
          rmpSalesByDate.set(date, (rmpSalesByDate.get(date) || 0) + amount);
          rmpTotal += amount;

          const baseCoordinator =
            order.sales_coordinator ||
            order.raw_json?.sales_coordinator ||
            'Unknown';
          const cleanedCoordinator = (baseCoordinator ?? '').toString().trim() || 'Unknown';
          const mappedCoordinator =
            lookup[normalizeCoordinatorName(cleanedCoordinator)]?.name || cleanedCoordinator;

          rmpSalesByCoordinator.set(
            mappedCoordinator,
            (rmpSalesByCoordinator.get(mappedCoordinator) || 0) + amount
          );
          
          // Extract customer name from "Customer Name" field
          const customer = order.customer_name || 
                          order.raw_json?.['Customer Name'] ||
                          order.raw_json?.customer_name || 
                          order.raw_json?.customer || 
                          'Unknown Customer';
          
          // Track customers per coordinator
          if (!rmpCustomersByCoordinator.has(mappedCoordinator)) {
            rmpCustomersByCoordinator.set(mappedCoordinator, new Map());
          }
          const customerMap = rmpCustomersByCoordinator.get(mappedCoordinator)!;
          customerMap.set(customer, (customerMap.get(customer) || 0) + amount);
          
          // Add to table data
          rmpTableData.push({
            date,
            coordinator: mappedCoordinator,
            sales: amount,
            orderId: order.raw_json?.order_id || '-',
            customer,
          });

          rawCoordinatorNames.add(cleanedCoordinator);
        } else {
          rmpSkippedNoAmount++;
        }
      });
      
      console.log('📈 RMP Orders processing:', {
        processed: rmpOrders.length,
        skippedNoDate: rmpSkippedNoDate,
        skippedNoAmount: rmpSkippedNoAmount,
        totalSales: rmpTotal
      });

      // Process Custom Reports separately
      const orderReportSalesByDate = new Map<string, number>();
      const orderReportSalesByCoordinator = new Map<string, number>();
      const orderReportTableData: any[] = [];
      const orderReportCustomersByCoordinator = new Map<string, Map<string, number>>();
      let orderReportTotal = 0;
      let orderReportSkippedNoDate = 0;
      let orderReportSkippedNoAmount = 0;

      orderReports.forEach((order) => {
        const date = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : null;
        if (!date) {
          orderReportSkippedNoDate++;
          return;
        }

        const amountCandidates = [
          sanitizeNumeric(order.total_sales__including_gst_),
          sanitizeNumeric(order.sales_value__ex_taxes_),
          sanitizeNumeric((order as any).total_amount),
          sanitizeNumeric(order.raw_json?.total_sales__including_gst_),
          sanitizeNumeric(order.raw_json?.sales_value__ex_taxes_),
          sanitizeNumeric(order.raw_json?.total_amount),
          sanitizeNumeric(order.raw_json?.amount),
        ];

        const amount = amountCandidates.find((val) => val !== 0) ?? 0;
        
        if (amount > 0) {
          orderReportSalesByDate.set(date, (orderReportSalesByDate.get(date) || 0) + amount);
          orderReportTotal += amount;

          const baseCoordinator =
            order.key_account_manager__kam_ ||
            order.raw_json?.key_account_manager__kam_ ||
            order.raw_json?.['Key Account Manager (KAM)'] ||
            order.raw_json?.sales_coordinator ||
            'Unknown';
          const cleanedCoordinator = (baseCoordinator ?? '').toString().trim() || 'Unknown';
          const mappedCoordinator =
            lookup[normalizeCoordinatorName(cleanedCoordinator)]?.name || cleanedCoordinator;
          orderReportSalesByCoordinator.set(
            mappedCoordinator,
            (orderReportSalesByCoordinator.get(mappedCoordinator) || 0) + amount
          );
          
          // Extract customer name from "Customer Name" field
          const customer = order.customer_name ||
                          order.raw_json?.['Customer Name'] ||
                          order.raw_json?.customer_name || 
                          order.raw_json?.customer || 
                          order.raw_json?.customer_name__from_customers_ ||
                          'Unknown Customer';
          
          // Track customers per coordinator
          if (!orderReportCustomersByCoordinator.has(mappedCoordinator)) {
            orderReportCustomersByCoordinator.set(mappedCoordinator, new Map());
          }
          const customerMap = orderReportCustomersByCoordinator.get(mappedCoordinator)!;
          customerMap.set(customer, (customerMap.get(customer) || 0) + amount);
          
          // Add to table data
          orderReportTableData.push({
            date,
            coordinator: mappedCoordinator,
            sales: amount,
            orderId: order.raw_json?.order_id || order.raw_json?.jobsheet_number || '-',
            customer,
          });

          rawCoordinatorNames.add(cleanedCoordinator);
        } else {
          orderReportSkippedNoAmount++;
        }
      });
      
      console.log('📈 Custom Report processing:', {
        processed: orderReports.length,
        skippedNoDate: orderReportSkippedNoDate,
        skippedNoAmount: orderReportSkippedNoAmount,
        totalSales: orderReportTotal
      });

      // Convert to arrays for charts
      const rmpDailyArray: SalesData[] = Array.from(rmpSalesByDate.entries())
        .map(([date, sales]) => ({ date, sales }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const orderReportDailyArray: SalesData[] = Array.from(orderReportSalesByDate.entries())
        .map(([date, sales]) => ({ date, sales }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const rmpCoordinatorArray: CoordinatorSales[] = Array.from(rmpSalesByCoordinator.entries())
        .map(([coordinator, sales]) => ({ coordinator, sales }))
        .sort((a, b) => b.sales - a.sales);

      const orderReportCoordinatorArray: CoordinatorSales[] = Array.from(orderReportSalesByCoordinator.entries())
        .map(([coordinator, sales]) => ({ coordinator, sales }))
        .sort((a, b) => b.sales - a.sales);

      setRmpDailySales(rmpDailyArray);
      setOrderReportDailySales(orderReportDailyArray);
      setRmpCoordinatorSales(rmpCoordinatorArray);
      setOrderReportCoordinatorSales(orderReportCoordinatorArray);
      setRmpTotalSales(rmpTotal);
      setOrderReportTotalSales(orderReportTotal);
      setRmpCoordinatorTable(rmpTableData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setOrderReportCoordinatorTable(orderReportTableData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      // Process top customers per coordinator for RMP
      const rmpTopCustomers = new Map<string, Array<{customer: string; sales: number}>>();
      rmpCustomersByCoordinator.forEach((customerMap, coordinator) => {
        const customers = Array.from(customerMap.entries())
          .map(([customer, sales]) => ({ customer, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5); // Top 5
        rmpTopCustomers.set(coordinator, customers);
      });
      setRmpCoordinatorCustomers(rmpTopCustomers);

      // Process top customers per coordinator for Custom Report
      const orderReportTopCustomers = new Map<string, Array<{customer: string; sales: number}>>();
      orderReportCustomersByCoordinator.forEach((customerMap, coordinator) => {
        const customers = Array.from(customerMap.entries())
          .map(([customer, sales]) => ({ customer, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5); // Top 5
        orderReportTopCustomers.set(coordinator, customers);
      });
      setOrderReportCoordinatorCustomers(orderReportTopCustomers);

      setAvailableCoordinators(
        Array.from(rawCoordinatorNames)
          .map((name) => name)
          .sort((a, b) => a.localeCompare(b))
      );

      // Calculate growth metrics from combined data
      const combinedDaily = [...rmpDailyArray, ...orderReportDailyArray].reduce((acc, item) => {
        acc.set(item.date, (acc.get(item.date) || 0) + item.sales);
        return acc;
      }, new Map<string, number>());
      
      const combinedArray: SalesData[] = Array.from(combinedDaily.entries())
        .map(([date, sales]) => ({ date, sales }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      calculateGrowthMetrics(combinedArray);
  }

  function calculateGrowthMetrics(dailySales: SalesData[]) {
      if (dailySales.length < 2) return;

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      const getSalesForDate = (date: Date): number => {
        const dateStr = date.toISOString().split('T')[0];
        const data = dailySales.find((d) => d.date === dateStr);
        return data?.sales || 0;
      };

      const getSalesForPeriod = (startDate: Date, endDate: Date): number => {
        return dailySales
          .filter((d) => {
            const dDate = new Date(d.date);
            return dDate >= startDate && dDate <= endDate;
          })
          .reduce((sum, d) => sum + d.sales, 0);
      };

      const todaySales = getSalesForDate(today);
      const yesterdaySales = getSalesForDate(yesterday);
      const thisWeekSales = getSalesForPeriod(
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        today
      );
      const lastWeekSales = getSalesForPeriod(
        new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      );
      const thisMonthSales = getSalesForPeriod(
        new Date(today.getFullYear(), today.getMonth(), 1),
        today
      );
      const lastMonthSales = getSalesForPeriod(
        new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
      );
      const thisYearSales = getSalesForPeriod(
        new Date(today.getFullYear(), 0, 1),
        today
      );
      const lastYearSales = getSalesForPeriod(
        new Date(lastYear.getFullYear(), 0, 1),
        new Date(lastYear.getFullYear(), 11, 31)
      );

      setGrowthMetrics({
        dod: yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0,
        wow: lastWeekSales > 0 ? ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100 : 0,
        mom: lastMonthSales > 0 ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100 : 0,
        yoy: lastYearSales > 0 ? ((thisYearSales - lastYearSales) / lastYearSales) * 100 : 0,
      });
  }

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => {
      clearInterval(refreshInterval);
    };
  }, [dateRange, startDate, endDate]);

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Sales Insights
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Analytics and statistics for your sales data
              </p>
              <div className="mt-2">
                <RefreshIndicator
                  onRefresh={fetchData}
                  lastRefreshed={lastRefreshed || undefined}
                />
              </div>
            </div>
            
            {/* Date Range Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setDateRange('7d')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === '7d'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setDateRange('30d')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === '30d'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => setDateRange('90d')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === '90d'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Last 90 Days
                </button>
                <button
                  onClick={() => setDateRange('custom')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Custom
                </button>
              </div>
              
              {dateRange === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <span className="text-gray-600 dark:text-gray-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sales Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Sales Value</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatINR(rmpTotalSales + orderReportTotalSales)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              RMP: {formatINR(rmpTotalSales)} | 
              Custom: {formatINR(orderReportTotalSales)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Day over Day (DoD)</div>
            <div className={`text-2xl font-bold ${growthMetrics.dod >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthMetrics.dod >= 0 ? '+' : ''}{growthMetrics.dod.toFixed(1)}%
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Week over Week (WoW)</div>
            <div className={`text-2xl font-bold ${growthMetrics.wow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthMetrics.wow >= 0 ? '+' : ''}{growthMetrics.wow.toFixed(1)}%
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Month over Month (MoM)</div>
            <div className={`text-2xl font-bold ${growthMetrics.mom >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthMetrics.mom >= 0 ? '+' : ''}{growthMetrics.mom.toFixed(1)}%
            </div>
          </motion.div>
        </div>

        {/* Year over Year Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Year over Year (YoY)</div>
          <div className={`text-3xl font-bold ${growthMetrics.yoy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {growthMetrics.yoy >= 0 ? '+' : ''}{growthMetrics.yoy.toFixed(1)}%
          </div>
        </motion.div>

        {/* Combined Sales Coordinator Performance */}
        {(rmpCoordinatorSales.length > 0 || orderReportCoordinatorSales.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Combined Sales Coordinator Performance
              </h3>
              <button
                onClick={() => {
                  setCoordinatorFormError(null);
                  setShowCoordinatorForm((prev) => !prev);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {showCoordinatorForm ? 'Close' : 'Add Custom Coordinator'}
              </button>
            </div>

            {showCoordinatorForm && (
              <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newCoordinatorName}
                      onChange={(e) => setNewCoordinatorName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Central Region Team"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Avatar URL (optional)
                    </label>
                    <input
                      type="url"
                      value={newCoordinatorAvatar}
                      onChange={(e) => setNewCoordinatorAvatar(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Map Existing Coordinators
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Already mapped coordinators are disabled.
                    </span>
                  </div>
                  <div className="grid gap-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-900/60">
                    {availableCoordinators.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No coordinator names detected yet. Refresh after data loads.
                      </p>
                    )}
                    {availableCoordinators.map((coordinator) => {
                      const normalized = normalizeCoordinatorName(coordinator);
                      const mapped = Boolean(coordinatorLookup[normalized]);
                      return (
                        <label
                          key={coordinator}
                          className={`flex items-center gap-3 text-sm ${
                            mapped ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={coordinator}
                            disabled={mapped}
                            checked={selectedSourceCoordinators.includes(coordinator)}
                            onChange={() => toggleSourceCoordinator(coordinator)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <span>{coordinator}</span>
                          {mapped && (
                            <span className="text-xs text-gray-400">
                              (Mapped to {coordinatorLookup[normalized]?.name})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {coordinatorFormError && (
                  <p className="mt-3 text-sm text-red-500">{coordinatorFormError}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleAddCoordinator}
                    disabled={isSavingCoordinator}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingCoordinator ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
                        Saving...
                      </>
                    ) : (
                      'Save Coordinator'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowCoordinatorForm(false);
                      setNewCoordinatorName('');
                      setNewCoordinatorAvatar('');
                      setSelectedSourceCoordinators([]);
                      setCoordinatorFormError(null);
                    }}
                    className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {coordinatorMappings.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Active Custom Coordinators
                </h4>
                <div className="flex flex-wrap gap-3">
                  {coordinatorMappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {mapping.avatar_url ? (
                        <img
                          src={mapping.avatar_url}
                          alt={mapping.name}
                          className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-semibold border border-blue-200 dark:border-blue-700">
                          {mapping.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{mapping.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {mapping.source_names.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Sales Coordinator
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      RMP Orders
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Custom Report
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total Sales
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Combine coordinators from both sources
                    const combined = new Map<string, { rmp: number; orderReport: number }>();
                    
                    rmpCoordinatorSales.forEach((item) => {
                      combined.set(item.coordinator, {
                        rmp: item.sales,
                        orderReport: combined.get(item.coordinator)?.orderReport || 0,
                      });
                    });
                    
                    orderReportCoordinatorSales.forEach((item) => {
                      const existing = combined.get(item.coordinator);
                      combined.set(item.coordinator, {
                        rmp: existing?.rmp || 0,
                        orderReport: item.sales,
                      });
                    });
                    
                    const totalSales = rmpTotalSales + orderReportTotalSales;
                    
                    return Array.from(combined.entries())
                      .map(([coordinator, sales]) => ({
                        coordinator,
                        rmp: sales.rmp,
                        orderReport: sales.orderReport,
                        total: sales.rmp + sales.orderReport,
                      }))
                      .sort((a, b) => b.total - a.total)
                      .map((item, index) => {
                        const percentage = totalSales > 0 ? (item.total / totalSales) * 100 : 0;
                        return (
                          <tr
                            key={item.coordinator}
                            className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                              <div className="flex items-center gap-2">
                                {index === 0 && <span className="text-xl" title="🥇 Gold">🥇</span>}
                                {index === 1 && <span className="text-xl" title="🥈 Silver">🥈</span>}
                                {index === 2 && <span className="text-xl" title="🥉 Bronze">🥉</span>}
                                <span>{item.coordinator}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                              {formatINR(item.rmp)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                              {formatINR(item.orderReport)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white font-bold">
                              {formatINR(item.total)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* RMP Orders - Sales Coordinator Performance */}
        {rmpCoordinatorSales.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                RMP Orders - Sales by Coordinator
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={rmpCoordinatorSales.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => formatINRCompact(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="coordinator"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatINR(value), 'Sales']}
                  />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
            >
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  RMP Orders - Detailed View
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sales data by coordinator and date
                </p>
              </div>

              {/* Interactive Heatmap/Timeline Chart */}
              {(() => {
                // Prepare data for heatmap
                const heatmapData = new Map<string, Map<string, number>>();
                const coordinators = new Set<string>();
                const dates = new Set<string>();

                rmpCoordinatorTable.forEach((item) => {
                  coordinators.add(item.coordinator);
                  dates.add(item.date);
                  if (!heatmapData.has(item.date)) {
                    heatmapData.set(item.date, new Map());
                  }
                  const dateMap = heatmapData.get(item.date)!;
                  dateMap.set(item.coordinator, (dateMap.get(item.coordinator) || 0) + item.sales);
                });

                const sortedDates = Array.from(dates).sort();
                // Sort coordinators by total sales (high to low)
                const sortedCoordinators = Array.from(coordinators).sort((a, b) => {
                  let aTotal = 0;
                  let bTotal = 0;
                  heatmapData.forEach((dateMap) => {
                    aTotal += dateMap.get(a) || 0;
                    bTotal += dateMap.get(b) || 0;
                  });
                  return bTotal - aTotal; // High to low
                });

                // Get max value for color scaling
                let maxValue = 0;
                heatmapData.forEach((dateMap) => {
                  dateMap.forEach((value) => {
                    if (value > maxValue) maxValue = value;
                  });
                });

                return (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Sales Heatmap
                    </h4>
                    <div className="overflow-x-auto">
                      <div className="inline-block min-w-full">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                Date \ Coordinator
                              </th>
                              {sortedCoordinators.slice(0, 15).map((coord) => (
                                <th
                                  key={coord}
                                  className="text-center py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]"
                                >
                                  <div className="truncate max-w-[100px]" title={coord}>
                                    {coord}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedDates.slice(-14).map((date) => {
                              const dateMap = heatmapData.get(date) || new Map();
                              return (
                                <tr key={date}>
                                  <td className="text-xs text-gray-900 dark:text-white py-2 px-2 sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                    {new Date(date).toLocaleDateString('en-IN', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </td>
                                  {sortedCoordinators.slice(0, 15).map((coord) => {
                                    const value = dateMap.get(coord) || 0;
                                    const intensity = maxValue > 0 ? value / maxValue : 0;
                                    // Light mode colors: gradient from light blue to dark blue
                                    const bgColor = intensity > 0.7 
                                      ? 'bg-blue-600 dark:bg-blue-600' 
                                      : intensity > 0.4 
                                      ? 'bg-blue-400 dark:bg-blue-400' 
                                      : intensity > 0.1 
                                      ? 'bg-blue-200 dark:bg-blue-200' 
                                      : 'bg-gray-100 dark:bg-gray-700';
                                    
                                    // Text color based on background intensity
                                    const textColor = intensity > 0.4 
                                      ? 'text-white dark:text-white' 
                                      : intensity > 0.1
                                      ? 'text-blue-900 dark:text-white'
                                      : 'text-gray-400 dark:text-gray-400';
                                    
                                    return (
                                      <td
                                        key={coord}
                                        className={`text-center py-2 px-2 text-xs ${bgColor} ${textColor} ${
                                          value > 0 ? 'font-medium' : ''
                                        }`}
                                        title={`${coord} on ${new Date(date).toLocaleDateString('en-IN')}: ${formatINR(value)}`}
                                      >
                                        {value > 0 ? formatINRCompact(value) : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>

            {/* Top Customers by Coordinator - RMP Orders */}
            {rmpCoordinatorCustomers.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top 5 Customers by Sales Coordinator (RMP Orders)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Interactive charts showing top 5 customers with sales amount and contribution percentage
                </p>
                <div className="space-y-8">
                  {Array.from(rmpCoordinatorCustomers.entries())
                    .sort((a, b) => {
                      // Sort coordinators by total sales
                      const aTotal = a[1].reduce((sum, c) => sum + c.sales, 0);
                      const bTotal = b[1].reduce((sum, c) => sum + c.sales, 0);
                      return bTotal - aTotal;
                    })
                    .map(([coordinator, customers]) => {
                      const coordinatorTotal = customers.reduce((sum, c) => sum + c.sales, 0);
                      const chartData = customers.map((customer, index) => {
                        const percentage = coordinatorTotal > 0 ? (customer.sales / coordinatorTotal) * 100 : 0;
                        return {
                          name: customer.customer.length > 20 ? customer.customer.substring(0, 20) + '...' : customer.customer,
                          fullName: customer.customer,
                          sales: customer.sales,
                          percentage: percentage,
                          rank: index + 1,
                        };
                      });
                      
                      return (
                        <div key={coordinator} className="border-b border-gray-200 dark:border-gray-700 pb-8 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                              {coordinator}
                            </h4>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Total: {formatINR(coordinatorTotal)}
                            </span>
                          </div>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis
                                type="number"
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                tickFormatter={(value) => formatINRCompact(value)}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                width={150}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                }}
                                formatter={(value: number, name: string, props: any) => {
                                  if (name === 'sales') {
                                    return [
                                      `${formatINR(value)} (${props.payload.percentage.toFixed(1)}%)`,
                                      props.payload.fullName
                                    ];
                                  }
                                  return [formatINR(value), 'Sales'];
                                }}
                                labelFormatter={() => ''}
                              />
                              <Bar 
                                dataKey="sales" 
                                fill="#3b82f6" 
                                radius={[0, 8, 8, 0]}
                                animationDuration={800}
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#2563eb' : index === 1 ? '#3b82f6' : index === 2 ? '#60a5fa' : '#93c5fd'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Custom Report - Sales Coordinator Performance */}
        {orderReportCoordinatorSales.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Custom Report - Sales by Coordinator (KAM)
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={orderReportCoordinatorSales.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => formatINRCompact(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="coordinator"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatINR(value), 'Sales']}
                  />
                  <Bar dataKey="sales" fill="#10b981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Custom Report - Detailed View (Sales Coordinator & Date)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Sales Coordinator (KAM)
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Order ID
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Sales Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderReportCoordinatorTable.slice(0, 100).map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                          {new Date(item.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                          {item.coordinator}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {item.orderId}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white font-medium">
                          {formatINR(item.sales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Top Customers by Coordinator - Custom Report */}
            {orderReportCoordinatorCustomers.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top 5 Customers by Sales Coordinator (Custom Report)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Interactive charts showing top 5 customers with sales amount and contribution percentage
                </p>
                <div className="space-y-8">
                  {Array.from(orderReportCoordinatorCustomers.entries())
                    .sort((a, b) => {
                      // Sort coordinators by total sales
                      const aTotal = a[1].reduce((sum, c) => sum + c.sales, 0);
                      const bTotal = b[1].reduce((sum, c) => sum + c.sales, 0);
                      return bTotal - aTotal;
                    })
                    .map(([coordinator, customers]) => {
                      const coordinatorTotal = customers.reduce((sum, c) => sum + c.sales, 0);
                      const chartData = customers.map((customer, index) => {
                        const percentage = coordinatorTotal > 0 ? (customer.sales / coordinatorTotal) * 100 : 0;
                        return {
                          name: customer.customer.length > 20 ? customer.customer.substring(0, 20) + '...' : customer.customer,
                          fullName: customer.customer,
                          sales: customer.sales,
                          percentage: percentage,
                          rank: index + 1,
                        };
                      });
                      
                      return (
                        <div key={coordinator} className="border-b border-gray-200 dark:border-gray-700 pb-8 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                              {coordinator}
                            </h4>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Total: {formatINR(coordinatorTotal)}
                            </span>
                          </div>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis
                                type="number"
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                tickFormatter={(value) => formatINRCompact(value)}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                width={150}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                }}
                                formatter={(value: number, name: string, props: any) => {
                                  if (name === 'sales') {
                                    return [
                                      `${formatINR(value)} (${props.payload.percentage.toFixed(1)}%)`,
                                      props.payload.fullName
                                    ];
                                  }
                                  return [formatINR(value), 'Sales'];
                                }}
                                labelFormatter={() => ''}
                              />
                              <Bar 
                                dataKey="sales" 
                                fill="#10b981" 
                                radius={[0, 8, 8, 0]}
                                animationDuration={800}
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : index === 1 ? '#10b981' : index === 2 ? '#34d399' : '#6ee7b7'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </>
        )}

      </main>
      <BottomNav />
    </div>
  );
}

