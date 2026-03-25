import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

import { useAuth } from './use-auth';

export interface InventoryItem {
  id: number;
  branch_id: number;
  name: string;
  unit_of_measure: string;
  description: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  branch_name: string;
  is_low_stock: boolean;
}

export interface InventoryMovement {
  id: number;
  inventory_id: number;
  user_id: number;
  movement_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: number | null;
  reason: string | null;
  created_at: string;
  user_name: string;
}

export interface CreateInventoryInput {
  branch_id: number;
  name: string;
  unit_of_measure: string;
  description?: string;
  low_stock_threshold?: number;
}

export type AdjustmentType = 'adjustment' | 'waste' | 'transfer';

export interface AdjustStockInput {
  inventory_id: number;
  /** Positive to add, negative to remove. */
  quantity_change: number;
  movement_type: AdjustmentType;
  reason?: string;
}

/**
 * Online-only hook for inventory management (admin/manager).
 * Reads and writes go through the REST API at EXPO_PUBLIC_API_URL.
 * Order-based stock deduction remains offline (handled by inventory.service.ts via PowerSync).
 */
export function useInventory() {
  const { user } = useAuth();
  const branchId = user?.branch_id ?? 0;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<InventoryItem[]>(
        `/api/v1/inventory?branch_id=${branchId}&page_size=100`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const createInventory = useCallback(async (input: CreateInventoryInput): Promise<InventoryItem> => {
    const created = await api.post<InventoryItem>('/api/v1/inventory', input);
    setItems((prev) => [...prev, created]);
    return created;
  }, []);

  const adjustStock = useCallback(async (input: AdjustStockInput): Promise<InventoryItem> => {
    const updated = await api.post<InventoryItem>('/api/v1/inventory/adjust', input);
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    return updated;
  }, []);

  const updateThreshold = useCallback(
    async (inventoryId: number, threshold: number): Promise<InventoryItem> => {
      const updated = await api.patch<InventoryItem>(
        `/api/v1/inventory/${inventoryId}/threshold`,
        { low_stock_threshold: threshold },
      );
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      return updated;
    },
    [],
  );

  const getMovements = useCallback(
    (inventoryId: number): Promise<InventoryMovement[]> =>
      api.get<InventoryMovement[]>(`/api/v1/inventory/${inventoryId}/movements`),
    [],
  );

  return {
    items,
    isLoading,
    error,
    fetchInventory,
    createInventory,
    adjustStock,
    updateThreshold,
    getMovements,
  };
}
