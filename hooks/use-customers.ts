import { useQuery } from '@powersync/react';
import { useCallback, useState } from 'react';

import type { Customer } from '@/db/models';
import { getNextAutoId } from '@/db/utils';
import { captureError } from '@/lib/sentry';
import { powersync } from '@/db/provider';

/**
 * Customer order history row — past orders with totals
 */
export interface CustomerOrderHistory {
  id: number;
  order_number: string;
  order_type: string;
  total: number;
  status: string;
  created_at: string;
}

/**
 * New customer input — phone is required for registration
 */
export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

/**
 * Hook to manage customers.
 * - Reactive search by name or phone
 * - Create new customer (phone-number-based registration)
 * - Award/deduct loyalty points
 * - Load order history for a customer
 */
export function useCustomers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const likeQuery = `%${searchQuery}%`;

  // Reactive search — updates whenever searchQuery changes
  const { data: customers = [], isLoading } = useQuery<Customer>(
    `SELECT * FROM customers
     WHERE is_active = 1
       AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
     ORDER BY name ASC
     LIMIT 50`,
    [likeQuery, likeQuery, likeQuery]
  );

  /**
   * Creates a new customer with phone-number-based registration.
   * Phone is required and must be unique.
   */
  const createCustomer = useCallback(
    async (input: CreateCustomerInput): Promise<Customer> => {
      setIsCreating(true);
      setCreateError(null);

      try {
        if (!input.phone?.trim()) {
          throw new Error('Phone number is required for customer registration.');
        }
        if (!input.name?.trim()) {
          throw new Error('Customer name is required.');
        }

        // Check for duplicate phone number
        const existing = await powersync.getOptional<{ id: number }>(
          `SELECT id FROM customers WHERE phone = ? AND is_active = 1 LIMIT 1`,
          [input.phone.trim()]
        );
        if (existing) {
          throw new Error(`A customer with phone ${input.phone} already exists.`);
        }

        const newId = (await getNextAutoId('customers')).toString();
        const now = new Date().toISOString();

        await powersync.execute(
          `INSERT INTO customers (
            id, name, phone, email, address, loyalty_points, total_visits,
            total_spent, notes, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            input.name.trim(),
            input.phone.trim(),
            input.email?.trim() ?? null,
            input.address?.trim() ?? null,
            0,
            0,
            0,
            input.notes?.trim() ?? null,
            1,
            now,
            now,
          ]
        );

        const created = await powersync.getOptional<Customer>(
          `SELECT * FROM customers WHERE id = ?`,
          [newId]
        );
        if (!created) throw new Error('Failed to retrieve created customer.');
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create customer.';
        setCreateError(message);
        captureError(err, { module: 'customer', operation: 'createCustomer', level: 'error' });
        throw new Error(message);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  /**
   * Awards (positive delta) or deducts (negative delta) loyalty points.
   */
  const updateLoyaltyPoints = useCallback(
    async (customerId: number, delta: number): Promise<void> => {
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE customers
         SET loyalty_points = MAX(0, loyalty_points + ?), updated_at = ?
         WHERE id = ?`,
        [delta, now, customerId]
      );
    },
    []
  );

  /**
   * Increments visit counter and total spent after an order is paid.
   */
  const recordVisit = useCallback(
    async (customerId: number, amountSpent: number): Promise<void> => {
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE customers
         SET total_visits = total_visits + 1,
             total_spent = total_spent + ?,
             updated_at = ?
         WHERE id = ?`,
        [amountSpent, now, customerId]
      );
    },
    []
  );

  /**
   * Fetches a single customer by ID.
   */
  const getCustomerById = useCallback(
    async (customerId: number): Promise<Customer | null> => {
      return powersync.getOptional<Customer>(
        `SELECT * FROM customers WHERE id = ? AND is_active = 1 LIMIT 1`,
        [customerId]
      );
    },
    []
  );

  /**
   * Fetches order history for a customer.
   */
  const getCustomerOrderHistory = useCallback(
    async (customerId: number): Promise<CustomerOrderHistory[]> => {
      return powersync.getAll<CustomerOrderHistory>(
        `SELECT id, order_number, order_type, total, status, created_at
         FROM orders
         WHERE customer_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [customerId]
      );
    },
    []
  );

  return {
    customers,
    isLoading,
    searchQuery,
    setSearchQuery,
    isCreating,
    createError,
    createCustomer,
    updateLoyaltyPoints,
    recordVisit,
    getCustomerById,
    getCustomerOrderHistory,
  };
}
