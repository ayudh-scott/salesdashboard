'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { motion } from 'framer-motion';
import { RefreshIndicator } from '@/components/RefreshIndicator';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  approved: boolean;
  onboarded: boolean;
  company_name?: string;
  gst_no?: string;
  zone?: string;
  [key: string]: any;
}

interface CustomersResponse {
  success: boolean;
  data?: {
    users?: {
      data?: Customer[];
      pagy?: {
        page?: number;
        pages?: number;
        count?: number;
        items?: number;
      };
    };
    customers?: Customer[];
    data?: Customer[];
    items?: Customer[];
    results?: Customer[];
    pagination?: {
      current_page: number;
      total_pages: number;
      total_items: number;
      items_per_page: number;
    };
    stats?: any;
  };
  message?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCustomers = async (page: number = 1) => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const response = await fetch(
        `/api/customers?items=${itemsPerPage}&page=${page}&approved=true&role=Customer`
      );

      const responseData: any = await response.json();

      if (!response.ok) {
        const errorData = responseData as { error: string; details?: string };
        console.error('❌ Customers API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Failed to fetch customers: ${response.statusText}`);
      }

      const data = responseData as CustomersResponse;

      console.log('📊 Customers API response:', {
        success: data.success,
        hasData: !!data.data,
        dataKeys: data.data ? Object.keys(data.data) : [],
        dataStructure: data.data,
        customersCount: data.data?.customers?.length || 0,
        message: data.message
      });

      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to fetch customers');
      }

      // Handle different possible response structures
      // API returns: { users: { data: [...], pagy: {...} }, stats: {...} }
      const customers = 
        data.data.users?.data || 
        data.data.customers || 
        data.data.data || 
        data.data.items || 
        data.data.results ||
        (Array.isArray(data.data) ? data.data : []) ||
        [];
      
      console.log('👥 Extracted customers:', {
        count: customers.length,
        firstCustomer: customers[0] || null
      });
      
      setCustomers(Array.isArray(customers) ? customers : []);
      
      // Handle pagination from pagy object or pagination object
      const pagy = data.data.users?.pagy;
      const pagination = data.data.pagination;
      
      if (pagy) {
        // Handle pagy format
        setCurrentPage(pagy.page || 1);
        setTotalPages(pagy.pages || 1);
        setTotalItems(pagy.count || 0);
        setItemsPerPage(pagy.items || itemsPerPage);
      } else if (pagination) {
        // Handle pagination format
        setCurrentPage(pagination.current_page || 1);
        setTotalPages(pagination.total_pages || 1);
        setTotalItems(pagination.total_items || 0);
        setItemsPerPage(pagination.items_per_page || itemsPerPage);
      }

      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err.message || 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
  }, []);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setLoading(true);
      fetchCustomers(page);
    }
  };

  const handleRefresh = () => {
    fetchCustomers(currentPage);
  };

  if (loading && customers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading customers...</p>
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
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Customers
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Customer data from Leaderboard API
              </p>
            </div>
            <RefreshIndicator
              onRefresh={handleRefresh}
              lastRefreshed={lastRefreshed || undefined}
            />
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          </motion.div>
        )}

        {customers.length === 0 && !loading && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No customers found</p>
          </div>
        )}

        {customers.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {customers.length} of {totalItems} customers
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {customers.map((customer, index) => {
                // Safely extract name - handle both string and object formats
                const customerName = typeof customer.name === 'string' 
                  ? customer.name 
                  : (customer.name?.name || customer.name?.value || customer.customer_company_name || customer.company_name || 'Unknown Customer');
                
                // Safely extract company name
                const companyName = typeof customer.company_name === 'string'
                  ? customer.company_name
                  : (customer.company_name?.name || customer.company_name?.value || customer.customer_company_name || '');
                
                // Safely extract other fields
                const customerEmail = typeof customer.email === 'string' ? customer.email : (customer.email?.value || '');
                const customerPhone = typeof customer.phone === 'string' ? customer.phone : (customer.phone?.value || '');
                const customerZone = typeof customer.zone === 'string' ? customer.zone : (customer.zone?.name || customer.zone?.value || '');
                const customerGst = typeof customer.gst_no === 'string' ? customer.gst_no : (customer.gst_no?.value || '');
                
                return (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {customerName}
                      </h3>
                      {companyName && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {companyName}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {customer.approved && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                          Approved
                        </span>
                      )}
                      {customer.onboarded && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                          Onboarded
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {customerEmail && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="truncate">{customerEmail}</span>
                      </div>
                    )}

                    {customerPhone && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
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
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <span>{customerPhone}</span>
                      </div>
                    )}

                    {customerZone && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
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
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>Zone: {customerZone}</span>
                      </div>
                    )}

                    {customerGst && (
                      <div className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">GST:</span> {customerGst}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

