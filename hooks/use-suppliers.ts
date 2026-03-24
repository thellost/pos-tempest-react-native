import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierFormInput {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Supplier[]>('/api/v1/suppliers?page_size=100');
      setSuppliers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const createSupplier = useCallback(async (input: SupplierFormInput): Promise<Supplier> => {
    const created = await api.post<Supplier>('/api/v1/suppliers', input);
    setSuppliers((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateSupplier = useCallback(
    async (id: number, input: SupplierFormInput): Promise<Supplier> => {
      const updated = await api.put<Supplier>(`/api/v1/suppliers/${id}`, input);
      setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    [],
  );

  return { suppliers, isLoading, error, fetchSuppliers, createSupplier, updateSupplier };
}
