import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { PurchaseStatus, UnitOfMeasure } from '@/constants/enums';
import { useAuth } from './use-auth';

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  inventory_id: number;
  inventory_name: string;
  quantity: number;
  unit_of_measure: UnitOfMeasure;
  cost_per_unit: number;
  total: number;
}

export interface Purchase {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name: string;
  branch_id: number;
  branch_name: string;
  status: PurchaseStatus;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  ordered_by: number;
  ordered_by_name: string;
  ordered_at: string;
  received_by: number | null;
  received_by_name: string | null;
  received_at: string | null;
  items?: PurchaseItem[];
}

export interface CreatePurchaseItem {
  inventory_id: number;
  inventory_name: string; // local only for display
  quantity: number;
  unit_of_measure: UnitOfMeasure;
  cost_per_unit: number;
}

export interface CreatePurchaseInput {
  supplier_id: number;
  branch_id: number;
  notes?: string;
  tax_amount?: number;
  items: Omit<CreatePurchaseItem, 'inventory_name'>[];
}

export function usePurchases() {
  const { user } = useAuth();
  const branchId = user?.branch_id ?? 0;

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchases = useCallback(
    async (statusFilter?: string) => {
      if (!branchId) return;
      setIsLoading(true);
      setError(null);
      try {
        let path = `/api/v1/purchases?branch_id=${branchId}&page_size=50`;
        if (statusFilter) path += `&status=${statusFilter}`;
        const data = await api.get<Purchase[]>(path);
        setPurchases(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load purchases');
      } finally {
        setIsLoading(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const getPurchase = useCallback(
    (id: number): Promise<Purchase> => api.get<Purchase>(`/api/v1/purchases/${id}`),
    [],
  );

  const createPurchase = useCallback(async (input: CreatePurchaseInput): Promise<Purchase> => {
    const created = await api.post<Purchase>('/api/v1/purchases', input);
    setPurchases((prev) => [created, ...prev]);
    return created;
  }, []);

  const receivePurchase = useCallback(async (id: number, notes?: string): Promise<Purchase> => {
    const updated = await api.post<Purchase>(`/api/v1/purchases/${id}/receive`, { notes: notes ?? '' });
    setPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const cancelPurchase = useCallback(async (id: number): Promise<Purchase> => {
    const updated = await api.patch<Purchase>(`/api/v1/purchases/${id}/cancel`, {});
    setPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  return {
    purchases,
    isLoading,
    error,
    branchId,
    fetchPurchases,
    getPurchase,
    createPurchase,
    receivePurchase,
    cancelPurchase,
  };
}
