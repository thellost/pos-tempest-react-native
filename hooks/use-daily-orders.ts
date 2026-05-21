import { useQuery } from '@powersync/react';
import { useCallback, useMemo, useState } from 'react';

import type { OrderStatus, PaymentStatus } from '@/constants/enums';
import { useAuth } from './use-auth';
import { useDevice } from './use-device';
import { getAppDateString } from '@/utils/date';
import { getAppTimezone } from '@/utils/timezone';

export interface DailyOrderRow {
  id: number | string;
  order_number: string;
  table_id: number | null;
  table_number: string | null;
  customer_name: string | null;
  order_type: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  subtotal: number;
  created_at: string;
  cashier_name: string | null;
  guest_count: number | null;
}

type StatusFilter = 'all' | OrderStatus;

/**
 * Compute UTC ISO boundaries for "today" in the app timezone.
 */
function getTodayBoundaries(): { start: string; end: string } {
  const todayStr = getAppDateString(); // YYYY-MM-DD in app tz
  const tz = getAppTimezone();

  // Get the UTC offset for the app timezone at noon today (avoids DST edge cases)
  const noonLocal = new Date(`${todayStr}T12:00:00`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(noonLocal);

  const pObj = Object.fromEntries(parts.map(p => [p.type, parseInt(p.value, 10)]));
  const wallMs = Date.UTC(pObj.year, pObj.month - 1, pObj.day, pObj.hour, pObj.minute, pObj.second);
  const offsetMs = wallMs - noonLocal.getTime();

  // Start of day in app tz → UTC
  const startUtcMs = Date.UTC(
    parseInt(todayStr.slice(0, 4), 10),
    parseInt(todayStr.slice(5, 7), 10) - 1,
    parseInt(todayStr.slice(8, 10), 10),
    0, 0, 0,
  ) - offsetMs;

  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(endUtcMs).toISOString(),
  };
}

export function useDailyOrders() {
  const { user } = useAuth();
  const { registration } = useDevice();
  const branchId = registration?.branch?.id;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { start, end } = useMemo(() => getTodayBoundaries(), []);

  // Debug: log query boundaries to help diagnose timestamp issues
  console.log('[DailyOrders] boundaries:', { start, end, branchId });

  const { data: orders = [], isLoading } = useQuery<DailyOrderRow>(
    `SELECT
      o.id,
      o.order_number,
      o.table_id,
      t.table_number,
      c.name as customer_name,
      o.order_type,
      o.status,
      o.payment_status,
      o.total,
      o.subtotal,
      o.created_at,
      u.name as cashier_name,
      o.guest_count
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.cashier_id
    WHERE o.branch_id = ?
      AND REPLACE(o.created_at, ' ', 'T') >= ?
      AND REPLACE(o.created_at, ' ', 'T') < ?
    ORDER BY o.created_at DESC`,
    [branchId ?? 0, start, end],
  );

  // Debug: log raw order count after query
  console.log('[DailyOrders] raw orders count:', orders.length, orders.map(o => ({ id: o.id, status: o.status, created_at: o.created_at })));

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.table_number?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (typeof o.total === 'number' ? o.total : parseFloat(String(o.total)) || 0), 0);

    return {
      totalOrders: orders.length,
      completedCount: completedOrders.length,
      totalRevenue,
      paidCount: paidOrders.length,
      activeCount: orders.length - completedOrders.length - orders.filter(o => o.status === 'cancelled').length,
    };
  }, [orders]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setSearchQuery('');
  }, []);

  return {
    orders: filteredOrders,
    allOrders: orders,
    isLoading,
    summary,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    clearFilters,
  };
}
