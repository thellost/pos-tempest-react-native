import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { FloorAreaTabs } from '@/components/floor/FloorAreaTabs';
import { TableCard } from '@/components/floor/TableCard';
import { TABLE_STATUS } from '@/constants/enums';
import { useTables } from '@/hooks/use-tables';

/**
 * Floor & Table Management screen.
 * Shows a visual floor plan with tables grouped by floor area.
 * Staff can see table status and tap to open/manage orders.
 */
export default function FloorScreen() {
  const {
    floorAreas,
    getTablesForArea,
    getOrderElapsedMinutes,
    availableTablesCount,
    occupiedTablesCount,
    reservedTablesCount,
    totalTablesCount,
    isLoading,
  } = useTables();

  // Track selected floor area (default to first area)
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(
    floorAreas.length > 0 ? (typeof floorAreas[0].id === 'string' ? parseInt(floorAreas[0].id, 10) : floorAreas[0].id) : null
  );

  // Update selected area when floor areas load
  if (floorAreas.length > 0 && selectedAreaId === null) {
    const firstAreaId = typeof floorAreas[0].id === 'string' ? parseInt(floorAreas[0].id, 10) : floorAreas[0].id;
    setSelectedAreaId(firstAreaId);
  }

  // Get tables for the currently selected floor area
  const currentTables = selectedAreaId ? getTablesForArea(selectedAreaId) : [];

  // Handle table press - navigate to order screen
  const handleTablePress = (tableId: number, activeOrderId: number | null, status: string) => {
    if (status === TABLE_STATUS.MAINTENANCE) {
      return; // Don't allow interaction with maintenance tables
    }

    if (activeOrderId) {
      // Navigate to existing order
      router.push({
        pathname: '/(app)/order/[tableId]',
        params: { tableId: tableId.toString(), orderId: activeOrderId.toString() },
      });
    } else {
      // Navigate to create new order
      router.push({
        pathname: '/(app)/order/[tableId]',
        params: { tableId: tableId.toString() },
      });
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-pos-base text-pos-muted">Loading floor plan...</Text>
      </View>
    );
  }

  if (floorAreas.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-pos-xl font-semibold text-pos-text-strong">No Floor Areas</Text>
        <Text className="mt-2 text-center text-pos-base text-pos-muted">
          No floor areas configured for this branch. Please contact your administrator.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header with stats */}
      <View className="border-b border-white/10 bg-surface-soft px-4 py-4">
        <Text className="mb-3 text-pos-3xl font-bold text-pos-text-strong">Floor Plan</Text>
        <View className="flex-row items-center gap-4">
          <View>
            <Text className="text-pos-xs text-pos-muted">Available</Text>
            <Text className="text-pos-xl font-bold text-green-500">{availableTablesCount}</Text>
          </View>
          <View>
            <Text className="text-pos-xs text-pos-muted">Occupied</Text>
            <Text className="text-pos-xl font-bold text-red-500">{occupiedTablesCount}</Text>
          </View>
          <View>
            <Text className="text-pos-xs text-pos-muted">Reserved</Text>
            <Text className="text-pos-xl font-bold text-yellow-500">{reservedTablesCount}</Text>
          </View>
          <View>
            <Text className="text-pos-xs text-pos-muted">Total</Text>
            <Text className="text-pos-xl font-bold text-pos-text-strong">{totalTablesCount}</Text>
          </View>
        </View>
      </View>

      {/* Floor area tabs */}
      <FloorAreaTabs
        floorAreas={floorAreas}
        selectedAreaId={selectedAreaId}
        onSelectArea={setSelectedAreaId}
      />

      {/* Table grid */}
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
      >
        {currentTables.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-pos-base text-pos-muted">
              No tables in this area
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-4">
            {currentTables.map((table) => (
              <View key={`table-${table.id}`} className="w-[31%]">
                <TableCard
                  table={table}
                  elapsedMinutes={getOrderElapsedMinutes(table.order_created_at)}
                  onPress={() => handleTablePress(table.id, table.active_order_id, table.status)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
