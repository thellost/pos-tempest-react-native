import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Package, ShoppingCart, Truck } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';

import { PurchasesTab } from '@/components/inventory/PurchasesTab';
import { StockTab } from '@/components/inventory/StockTab';
import { SuppliersTab } from '@/components/inventory/SuppliersTab';

type InventoryTab = 'stock' | 'purchases' | 'suppliers';

const TABS: { key: InventoryTab; label: string }[] = [
  { key: 'stock', label: 'Stock' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'suppliers', label: 'Suppliers' },
];

export default function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');

  return (
    <View className="flex-1 bg-surface">

      <View className="flex-row border-b border-border bg-surface-card">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const iconColor = isActive ? ThemeColors.accent.primary : ThemeColors.text.muted;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 flex-row items-center justify-center gap-2 py-3"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: isActive ? ThemeColors.accent.primary : 'transparent',
              }}
            >
              {tab.key === 'stock' && <Package size={16} color={iconColor} />}
              {tab.key === 'purchases' && <ShoppingCart size={16} color={iconColor} />}
              {tab.key === 'suppliers' && <Truck size={16} color={iconColor} />}
              <Text
                className="text-pos-sm font-bold"
                style={{ color: iconColor }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'stock' && <StockTab />}
      {activeTab === 'purchases' && <PurchasesTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
    </View>
  );
}
