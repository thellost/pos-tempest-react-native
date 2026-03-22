import { useQuery } from '@powersync/react';
import { useMemo } from 'react';

import { ORDER_STATUS, ORDER_TYPE } from '@/constants/enums';
import { getElapsedMinutes } from '@/utils/date';
import { useAuth } from './use-auth';

export interface TakeawayOrder {
  id: number | string;
  order_number: string;
  customer_id: number | null;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

export function useTakeaway() {
  const { user } = useAuth();
  const branchId = user?.branch_id;

  const { data: takeawayOrders = [], isLoading } = useQuery<TakeawayOrder>(
    `SELECT 
      o.id,
      o.order_number,
      o.customer_id,
      c.name as customer_name,
      o.total,
      o.status,
      o.created_at
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.branch_id = ? 
      AND o.order_type = ?
      AND o.status NOT IN (?, ?, ?)
    ORDER BY o.created_at DESC`,
    [
      branchId ?? 0,
      ORDER_TYPE.TAKEAWAY,
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.SERVED,
    ]
  );

  const activeTakeawayCount = useMemo(() => takeawayOrders.length, [takeawayOrders]);

  const getOrderElapsedMinutes = (orderCreatedAt: string | null): number =>
    getElapsedMinutes(orderCreatedAt);

  return {
    takeawayOrders,
    activeTakeawayCount,
    isLoading,
    getOrderElapsedMinutes,
  };
}
