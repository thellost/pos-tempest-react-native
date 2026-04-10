import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Plus, RefreshCw, ShoppingCart } from 'lucide-react-native';

import type { PurchaseStatus } from '@/constants/enums';
import { PURCHASE_STATUS } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { usePurchases } from '@/hooks/use-purchases';
import { useSuppliers } from '@/hooks/use-suppliers';

import { EmptyState } from './shared';
import { CreatePOModal } from './CreatePOModal';
import { PODetailModal } from './PODetailModal';
import { POListItem } from './POListItem';

// ─── constants ───────────────────────────────────────────────────────────────

const PURCHASE_STATUS_TABS: { key: 'all' | PurchaseStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: PURCHASE_STATUS.ORDERED, label: 'Ordered' },
  { key: PURCHASE_STATUS.PARTIAL_RECEIVED, label: 'Partial' },
  { key: PURCHASE_STATUS.RECEIVED, label: 'Received' },
  { key: PURCHASE_STATUS.CANCELLED, label: 'Cancelled' },
];

// ─── PurchasesTab ─────────────────────────────────────────────────────────────

export function PurchasesTab() {
  const { purchases, isLoading, error, fetchPurchases, getPurchase, createPurchase, receivePurchase, cancelPurchase, branchId } = usePurchases();
  const { suppliers } = useSuppliers();

  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    fetchPurchases(statusFilter === 'all' ? undefined : statusFilter);
  }, [statusFilter, fetchPurchases]);

  const filtered = statusFilter === 'all'
    ? purchases
    : purchases.filter((p) => p.status === statusFilter);

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-3">
        <Text className="text-pos-xl font-bold text-pos-text">Purchase Orders</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => fetchPurchases(statusFilter === 'all' ? undefined : statusFilter)}
            disabled={isLoading}
            hitSlop={8}
            className="p-1"
          >
            {isLoading
              ? <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
              : <RefreshCw size={18} color={ThemeColors.text.muted} />}
          </Pressable>
          <Pressable
            onPress={() => setShowCreate(true)}
            className="flex-row items-center gap-1 rounded-sm px-3"
            style={{ height: 32, backgroundColor: ThemeColors.accent.primary }}
          >
            <Plus size={14} color={ThemeColors.text.strong} />
            <Text className="text-pos-xs font-bold text-white">New PO</Text>
          </Pressable>
        </View>
      </View>

      <View className="border-b border-border bg-surface-card" style={{ height: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
          {PURCHASE_STATUS_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              className="rounded-sm px-4 py-1"
              style={{ backgroundColor: statusFilter === tab.key ? ThemeColors.accent.primary : ThemeColors.surfaces.raised }}
            >
              <Text
                className="text-pos-xs font-bold"
                style={{ color: statusFilter === tab.key ? ThemeColors.text.strong : ThemeColors.text.muted }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading && purchases.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-pos-base text-pos-text-muted">{error}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 6 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={32} color={ThemeColors.text.muted} />} message="No purchase orders" />
          ) : (
            filtered.map((po) => (
              <POListItem
                key={po.id}
                po={po}
                onPress={() => setDetailId(po.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      <CreatePOModal
        visible={showCreate}
        suppliers={suppliers}
        branchId={branchId}
        onClose={() => setShowCreate(false)}
        onCreate={createPurchase}
      />

      <PODetailModal
        purchaseId={detailId}
        onClose={() => setDetailId(null)}
        onReceive={receivePurchase}
        onCancel={cancelPurchase}
        getPurchase={getPurchase}
      />
    </View>
  );
}
