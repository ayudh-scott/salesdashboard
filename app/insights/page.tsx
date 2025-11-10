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
import { formatDate, formatINR, formatINRCompact } from '@/lib/utils';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import React from 'react';

interface TableMetadata {
  table_name: string;
  display_name: string;
  last_synced_at: string | null;
  record_count?: number;
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
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetrics>({
    dod: 0,
    wow: 0,
    mom: 0,
    yoy: 0,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

      // Fetch sales data from RMP Orders
      await fetchSalesData();
      
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  async function fetchSalesData() {
      try {
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

        // Fetch RMP Orders data
        const { data: rmpOrders, error: rmpError } = await supabase
          .from('rmp_orders')
          .select('order_date, total_amount, sales_coordinator, raw_json')
          .eq('deleted', false)
          .not('order_date', 'is', null)
          .gte('order_date', startDateStr)
          .lte('order_date', endDateStr)
          .order('order_date', { ascending: true });

        if (rmpError) {
          console.error('Error fetching RMP orders:', rmpError);
        }

        // Fetch Order Report data
        const { data: orderReports, error: orderError } = await supabase
          .from('order_report')
          .select('order_date, total_sales__including_gst_, sales_value__ex_taxes_, key_account_manager__kam_, raw_json')
          .eq('deleted', false)
          .not('order_date', 'is', null)
          .gte('order_date', startDateStr)
          .lte('order_date', endDateStr)
          .order('order_date', { ascending: true });

        if (orderError) {
          console.error('Error fetching order reports:', orderError);
        }

      // Process sales data separately
      processSalesData(rmpOrders || [], orderReports || []);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  }

  function processSalesData(rmpOrders: any[], orderReports: any[]) {
      // Process RMP Orders separately
      const rmpSalesByDate = new Map<string, number>();
      const rmpSalesByCoordinator = new Map<string, number>();
      const rmpTableData: any[] = [];
      const rmpCustomersByCoordinator = new Map<string, Map<string, number>>();
      let rmpTotal = 0;

      rmpOrders.forEach((order) => {
        const date = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : null;
        if (!date) return;

        const amount = order.total_amount || 
          parseFloat(order.raw_json?.total_amount) || 
          parseFloat(order.raw_json?.amount) || 0;
        
        if (amount > 0) {
          rmpSalesByDate.set(date, (rmpSalesByDate.get(date) || 0) + amount);
          rmpTotal += amount;

          const coordinator = order.sales_coordinator || order.raw_json?.sales_coordinator || 'Unknown';
          rmpSalesByCoordinator.set(coordinator, (rmpSalesByCoordinator.get(coordinator) || 0) + amount);
          
          // Extract customer name from various possible fields
          const customer = order.customer_name || 
                          order.raw_json?.customer_name || 
                          order.raw_json?.customer || 
                          order.raw_json?.client_name ||
                          order.raw_json?.client ||
                          order.raw_json?.company_name ||
                          order.raw_json?.company ||
                          'Unknown Customer';
          
          // Track customers per coordinator
          if (!rmpCustomersByCoordinator.has(coordinator)) {
            rmpCustomersByCoordinator.set(coordinator, new Map());
          }
          const customerMap = rmpCustomersByCoordinator.get(coordinator)!;
          customerMap.set(customer, (customerMap.get(customer) || 0) + amount);
          
          // Add to table data
          rmpTableData.push({
            date,
            coordinator,
            sales: amount,
            orderId: order.raw_json?.order_id || '-',
            customer,
          });
        }
      });

      // Process Order Reports separately
      const orderReportSalesByDate = new Map<string, number>();
      const orderReportSalesByCoordinator = new Map<string, number>();
      const orderReportTableData: any[] = [];
      const orderReportCustomersByCoordinator = new Map<string, Map<string, number>>();
      let orderReportTotal = 0;

      orderReports.forEach((order) => {
        const date = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : null;
        if (!date) return;

        const amount = parseFloat(order.total_sales__including_gst_) || 
          parseFloat(order.sales_value__ex_taxes_) ||
          parseFloat(order.raw_json?.total_sales__including_gst_) ||
          parseFloat(order.raw_json?.sales_value__ex_taxes_) || 0;
        
        if (amount > 0) {
          orderReportSalesByDate.set(date, (orderReportSalesByDate.get(date) || 0) + amount);
          orderReportTotal += amount;

          const coordinator = order.key_account_manager__kam_ || 
            order.raw_json?.key_account_manager__kam_ || 
            order.raw_json?.sales_coordinator || 
            'Unknown';
          orderReportSalesByCoordinator.set(coordinator, (orderReportSalesByCoordinator.get(coordinator) || 0) + amount);
          
          // Extract customer name from various possible fields
          const customer = order.raw_json?.customer_name || 
                          order.raw_json?.customer || 
                          order.raw_json?.client_name ||
                          order.raw_json?.client ||
                          order.raw_json?.company_name ||
                          order.raw_json?.company ||
                          order.raw_json?.customer_name__from_customers_ ||
                          'Unknown Customer';
          
          // Track customers per coordinator
          if (!orderReportCustomersByCoordinator.has(coordinator)) {
            orderReportCustomersByCoordinator.set(coordinator, new Map());
          }
          const customerMap = orderReportCustomersByCoordinator.get(coordinator)!;
          customerMap.set(customer, (customerMap.get(customer) || 0) + amount);
          
          // Add to table data
          orderReportTableData.push({
            date,
            coordinator,
            sales: amount,
            orderId: order.raw_json?.order_id || order.raw_json?.jobsheet_number || '-',
            customer,
          });
        }
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
          .slice(0, 10); // Top 10
        rmpTopCustomers.set(coordinator, customers);
      });
      setRmpCoordinatorCustomers(rmpTopCustomers);

      // Process top customers per coordinator for Order Report
      const orderReportTopCustomers = new Map<string, Array<{customer: string; sales: number}>>();
      orderReportCustomersByCoordinator.forEach((customerMap, coordinator) => {
        const customers = Array.from(customerMap.entries())
          .map(([customer, sales]) => ({ customer, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 10); // Top 10
        orderReportTopCustomers.set(coordinator, customers);
      });
      setOrderReportCoordinatorCustomers(orderReportTopCustomers);

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
              Orders: {formatINR(orderReportTotalSales)}
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Combined Sales Coordinator Performance
            </h3>
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
                      Order Report
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
                              {item.coordinator}
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
                  Top 10 Customers by Sales Coordinator (RMP Orders)
                </h3>
                <div className="space-y-6">
                  {Array.from(rmpCoordinatorCustomers.entries())
                    .sort((a, b) => {
                      // Sort coordinators by total sales
                      const aTotal = a[1].reduce((sum, c) => sum + c.sales, 0);
                      const bTotal = b[1].reduce((sum, c) => sum + c.sales, 0);
                      return bTotal - aTotal;
                    })
                    .map(([coordinator, customers]) => {
                      const coordinatorTotal = customers.reduce((sum, c) => sum + c.sales, 0);
                      return (
                        <div key={coordinator} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                              {coordinator}
                            </h4>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Total: {formatINR(coordinatorTotal)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {customers.map((customer, index) => {
                              const percentage = coordinatorTotal > 0 ? (customer.sales / coordinatorTotal) * 100 : 0;
                              return (
                                <div
                                  key={customer.customer}
                                  className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                      #{index + 1}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1 truncate" title={customer.customer}>
                                    {customer.customer}
                                  </div>
                                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    {formatINR(customer.sales)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Order Report - Sales Coordinator Performance */}
        {orderReportCoordinatorSales.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Order Report - Sales by Coordinator (KAM)
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
                Order Report - Detailed View (Sales Coordinator & Date)
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

            {/* Top Customers by Coordinator - Order Report */}
            {orderReportCoordinatorCustomers.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top 10 Customers by Sales Coordinator (Order Report)
                </h3>
                <div className="space-y-6">
                  {Array.from(orderReportCoordinatorCustomers.entries())
                    .sort((a, b) => {
                      // Sort coordinators by total sales
                      const aTotal = a[1].reduce((sum, c) => sum + c.sales, 0);
                      const bTotal = b[1].reduce((sum, c) => sum + c.sales, 0);
                      return bTotal - aTotal;
                    })
                    .map(([coordinator, customers]) => {
                      const coordinatorTotal = customers.reduce((sum, c) => sum + c.sales, 0);
                      return (
                        <div key={coordinator} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                              {coordinator}
                            </h4>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Total: {formatINR(coordinatorTotal)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {customers.map((customer, index) => {
                              const percentage = coordinatorTotal > 0 ? (customer.sales / coordinatorTotal) * 100 : 0;
                              return (
                                <div
                                  key={customer.customer}
                                  className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                      #{index + 1}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1 truncate" title={customer.customer}>
                                    {customer.customer}
                                  </div>
                                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                                    {formatINR(customer.sales)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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

