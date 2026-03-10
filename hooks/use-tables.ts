import { useQuery } from '@powersync/react';
import { useMemo } from 'react';

import { ORDER_STATUS, TABLE_STATUS } from '@/constants/enums';
import type { DiningTable, FloorArea } from '@/db/models';
import { powersync } from '@/db/provider';
import { useAuth } from './use-auth';
import { useDevice } from './use-device';

/**
 * Extended table info with active order details
 */
export interface TableWithOrder extends DiningTable {
  floor_area_name: string;
  active_order_id: number | null;
  active_order_number: string | null;
  guest_count: number | null;
  order_total: number | null;
  order_created_at: string | null;
  order_status: string | null;
}

/**
 * Hook to manage floor areas and tables with real-time updates.
 * Queries floor_areas + tables for the current branch,
 * joins with active orders to show occupied status and current bill total.
 */
export function useTables() {
  const { user } = useAuth();
  const branchId = user?.branch_id;
  const { deviceId, registration } = useDevice();
  // DEBUG show all tables statuses
  
  // Query floor areas for the current branch
  const { data: floorAreas = [], isLoading: areasLoading } = useQuery<FloorArea>(
    `SELECT * FROM floor_areas 
     WHERE branch_id = ? AND is_active = 1 
     ORDER BY sort_order ASC`,
    [branchId ?? 0]
  );

  // Query tables with joined order information
  const { data: rawTablesData = [], isLoading: tablesLoading } = useQuery<TableWithOrder>(
    `SELECT 
      t.*,
      fa.name as floor_area_name,
      o.id as active_order_id,
      o.order_number as active_order_number,
      o.guest_count,
      o.total as order_total,
      o.created_at as order_created_at,
      o.status as order_status
     FROM tables t
     LEFT JOIN floor_areas fa ON t.floor_area_id = fa.id
     LEFT JOIN orders o ON t.id = o.table_id 
       AND o.status NOT IN (?, ?, ?)
     WHERE t.branch_id = ? AND t.is_active = 1
     ORDER BY t.table_number ASC, o.created_at DESC`,
    [
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.SERVED,
      branchId ?? 0
    ]
  );


  // Deduplicate tables - keep only the first occurrence (most recent order due to ORDER BY).
  // Also derive effective status: if there's no active order but t.status is still OCCUPIED
  // (e.g. the void synced the order before the table status update), show AVAILABLE instead.
  // This prevents Device B from showing a table as occupied after a void on Device A.
  const tablesData = useMemo(() => {
    const seen = new Set<number>();
    return rawTablesData
      .filter(table => {
        const tableId = typeof table.id === 'string' ? parseInt(table.id, 10) : table.id;
        if (seen.has(tableId)) return false;
        seen.add(tableId);
        return true;
      })
      .map(table => ({
        ...table,
        status:
          !table.active_order_id && table.status === TABLE_STATUS.OCCUPIED
            ? TABLE_STATUS.AVAILABLE
            : table.status,
      }));
  }, [rawTablesData]);

  // Group tables by floor area
  const tablesByArea = useMemo(() => {
    const grouped = new Map<number, TableWithOrder[]>();
    
    tablesData.forEach(table => {
      // Ensure areaId is a number for consistent comparison
      const areaId = typeof table.floor_area_id === 'string' 
        ? parseInt(table.floor_area_id, 10) 
        : table.floor_area_id;
      if (!grouped.has(areaId)) {
        grouped.set(areaId, []);
      }
      grouped.get(areaId)?.push(table);
    });
    
    return grouped;
  }, [tablesData]);

  // Get tables for a specific floor area
  const getTablesForArea = (floorAreaId: number): TableWithOrder[] => {
    return tablesByArea.get(floorAreaId) ?? [];
  };

  // Get a single table by ID
  const getTableById = async (tableId: number): Promise<TableWithOrder | null> => {
    try {
      const result = await powersync.getOptional<TableWithOrder>(
        `SELECT 
          t.*,
          fa.name as floor_area_name,
          o.id as active_order_id,
          o.order_number as active_order_number,
          o.guest_count,
          o.total as order_total,
          o.created_at as order_created_at,
          o.status as order_status
         FROM tables t
         LEFT JOIN floor_areas fa ON t.floor_area_id = fa.id
         LEFT JOIN orders o ON t.id = o.table_id 
           AND o.status NOT IN (?, ?, ?)
         WHERE t.id = ?`,
        [
          ORDER_STATUS.COMPLETED,
          ORDER_STATUS.CANCELLED,
          ORDER_STATUS.SERVED,
          tableId
        ]
      );
      return result || null;
    } catch (error) {
      console.error('[useTables] Error fetching table by ID:', error);
      return null;
    }
  };

  // Update table status
  const updateTableStatus = async (tableId: number, status: string): Promise<void> => {
    try {
      await powersync.execute(
        `UPDATE tables SET status = ?, updated_at = ? WHERE id = ?`,
        [status, new Date().toISOString(), tableId]
      );
      console.log('[useTables] Updated table', tableId, 'status to', status);
    } catch (error) {
      console.error('[useTables] Error updating table status:', error);
      throw error;
    }
  };

  // Get available tables count
  const availableTablesCount = useMemo(() => {
    return tablesData.filter(t => t.status === TABLE_STATUS.AVAILABLE).length;
  }, [tablesData]);

  // Get occupied tables count
  const occupiedTablesCount = useMemo(() => {
    return tablesData.filter(t => t.status === TABLE_STATUS.OCCUPIED).length;
  }, [tablesData]);

  // Get reserved tables count
  const reservedTablesCount = useMemo(() => {
    return tablesData.filter(t => t.status === TABLE_STATUS.RESERVED).length;
  }, [tablesData]);

  // Get maintenance tables count
  const maintenanceTablesCount = useMemo(() => {
    return tablesData.filter(t => t.status === TABLE_STATUS.MAINTENANCE).length;
  }, [tablesData]);

  // Total tables count
  const totalTablesCount = useMemo(() => {
    return tablesData.length;
  }, [tablesData]);

  // Calculate elapsed time since order was created (in minutes)
  const getOrderElapsedMinutes = (orderCreatedAt: string | null): number => {
    if (!orderCreatedAt) return 0;
    const created = new Date(orderCreatedAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
  };

  return {
    floorAreas,
    tables: tablesData,
    tablesByArea,
    getTablesForArea,
    getTableById,
    updateTableStatus,
    availableTablesCount,
    occupiedTablesCount,
    reservedTablesCount,
    maintenanceTablesCount,
    totalTablesCount,
    getOrderElapsedMinutes,
    isLoading: areasLoading || tablesLoading,
  };
}
