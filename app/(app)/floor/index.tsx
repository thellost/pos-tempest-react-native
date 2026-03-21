import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { Armchair, MapPin, ShoppingBag } from 'lucide-react-native';

import { FloorAreaTabs } from '@/components/floor/FloorAreaTabs';
import { ReservationModal } from '@/components/floor/ReservationModal';
import { TableCard } from '@/components/floor/TableCard';
import { TABLE_STATUS } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { useReservations } from '@/hooks/use-reservations';
import { useShift } from '@/hooks/use-shift';
import { useTables, type TableWithOrder } from '@/hooks/use-tables';
import { useTakeaway, type TakeawayOrder } from '@/hooks/use-takeaway';
import { toInt } from '@/utils/coerce';

export default function FloorScreen() {
  const {
    floorAreas,
    getTablesForArea,
    getOrderElapsedMinutes,
    availableTablesCount,
    occupiedTablesCount,
    reservedTablesCount,
    totalTablesCount,
    isLoading: tablesLoading,
  } = useTables();

  const {
    takeawayOrders,
    activeTakeawayCount,
    isLoading: takeawayLoading,
    getOrderElapsedMinutes: getTakeawayElapsedMinutes,
  } = useTakeaway();

  const { isShiftOpen, loading: shiftLoading } = useShift();

  const { getReservationsForTable, formatReservationTime } = useReservations();

  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [isTakeawaySelected, setIsTakeawaySelected] = useState(false);
  const [reservationTable, setReservationTable] = useState<TableWithOrder | null>(null);

  useEffect(() => {
    if (floorAreas.length > 0 && selectedAreaId === null && !isTakeawaySelected) {
      const firstAreaId = toInt(floorAreas[0].id);
      setSelectedAreaId(firstAreaId);
    }
  }, [floorAreas, selectedAreaId, isTakeawaySelected]);

  const currentTables = selectedAreaId ? getTablesForArea(selectedAreaId) : [];

  const handleTablePress = (tableId: number, activeOrderId: number | null, status: string) => {
    if (status === TABLE_STATUS.MAINTENANCE) {
      return;
    }

    // Block creating a new order when no shift is open
    if (!activeOrderId && !isShiftOpen) {
      Alert.alert(
        'No Active Shift',
        'You need to open a shift before creating new orders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Shift', onPress: () => router.push('/(app)/shifts') },
        ]
      );
      return;
    }

    if (activeOrderId) {
      router.push({
        pathname: '/(app)/order/[tableId]',
        params: { tableId: tableId.toString(), orderId: activeOrderId.toString() },
      });
    } else {
      router.push({
        pathname: '/(app)/order/[tableId]',
        params: { tableId: tableId.toString() },
      });
    }
  };

  const handleTakeawayPress = () => {
    if (!isShiftOpen) {
      Alert.alert(
        'No Active Shift',
        'You need to open a shift before creating new orders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Shift', onPress: () => router.push('/(app)/shifts') },
        ]
      );
      return;
    }
    router.push('/(app)/order/takeaway');
  };

  const handleTakeawayOrderPress = (order: TakeawayOrder) => {
    router.push({
      pathname: '/(app)/order/takeaway',
      params: { orderId: String(order.id) },
    });
  };

  const handleSelectArea = (areaId: number | null, isTakeaway?: boolean) => {
    if (isTakeaway) {
      setIsTakeawaySelected(true);
      setSelectedAreaId(null);
    } else {
      setIsTakeawaySelected(false);
      setSelectedAreaId(areaId);
    }
  };

  const handleTableLongPress = async (table: TableWithOrder) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error();
    } catch {
      Alert.alert(
        'No Connection',
        'Reservations require an internet connection for backend verification.',
      );
      return;
    }
    setReservationTable(table);
  };

  const isLoading = tablesLoading || takeawayLoading || shiftLoading;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading floor plan...</Text>
      </View>
    );
  }

  if (floorAreas.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <MapPin size={32} color={ThemeColors.text.muted} />
        </View>
        <Text className="text-pos-xl font-semibold text-pos-text">No Floor Areas</Text>
        <Text className="mt-2 text-center text-pos-base text-pos-text-muted">
          No floor areas configured for this branch. Please contact your administrator.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="border-b border-border bg-surface-card px-5 py-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-pos-2xl font-bold text-pos-text">Tables & Orders</Text>
          <Button
            onPress={handleTakeawayPress}
            className="flex-row items-center rounded-lg bg-amber-500 px-5 py-3"
          >
            <ShoppingBag size={18} color="white" />
            <Text className="ml-2 text-pos-base font-bold text-white">Takeaway</Text>
          </Button>
        </View>
        <View className="mt-4 flex-row items-center gap-3">
          <View className="w-28 rounded-lg bg-status-available-muted px-4 py-2 items-center">
            <View className="flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full bg-status-available" />
              <Text className="text-pos-xs text-pos-text-muted">Available</Text>
            </View>
            <Text className="text-pos-xl font-bold text-status-available text-center">{availableTablesCount}</Text>
          </View>
          <View className="w-28 rounded-lg bg-status-occupied-muted px-4 py-2 items-center">
            <View className="flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full bg-status-occupied" />
              <Text className="text-pos-xs text-pos-text-muted">Occupied</Text>
            </View>
            <Text className="text-pos-xl font-bold text-status-occupied text-center">{occupiedTablesCount}</Text>
          </View>
          <View className="w-28 rounded-lg bg-status-reserved-muted px-4 py-2 items-center">
            <View className="flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full bg-status-reserved" />
              <Text className="text-pos-xs text-pos-text-muted">Reserved</Text>
            </View>
            <Text className="text-pos-xl font-bold text-status-reserved text-center">{reservedTablesCount}</Text>
          </View>
          <View className="w-28 rounded-lg bg-surface-raised px-4 py-2 items-center">
            <Text className="text-pos-xs text-pos-text-muted">Total</Text>
            <Text className="text-pos-xl font-bold text-pos-text text-center">{totalTablesCount}</Text>
          </View>
        </View>
      </View>

      <FloorAreaTabs
        floorAreas={floorAreas}
        selectedAreaId={selectedAreaId}
        onSelectArea={handleSelectArea}
        showTakeawayTab={true}
        isTakeawaySelected={isTakeawaySelected}
        activeTakeawayCount={activeTakeawayCount}
      />

      <ScrollView 
        className="flex-1 bg-surface"
        contentContainerStyle={{ padding: 16 }}
      >
        {isTakeawaySelected ? (
          takeawayOrders.length === 0 ? (
            <View className="items-center justify-center py-16">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
                <ShoppingBag size={32} color={ThemeColors.text.muted} />
              </View>
              <Text className="text-pos-base text-pos-text-muted">No active takeaway orders</Text>
              <Button
                onPress={handleTakeawayPress}
                className="mt-4 rounded-lg bg-amber-500 px-6 py-3"
              >
                <Text className="text-pos-base font-bold text-white">Create Takeaway Order</Text>
              </Button>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-4">
              {takeawayOrders.map((order) => (
                <Pressable
                  key={`takeaway-${order.id}`}
                  onPress={() => handleTakeawayOrderPress(order)}
                  className="w-[31%] rounded-lg bg-surface-card p-4 active:bg-surface-raised"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <ShoppingBag size={14} color={ThemeColors.text.primary} />
                      <Text className="text-pos-lg font-bold text-pos-text">{order.order_number}</Text>
                    </View>
                    <Text className="text-pos-xs text-pos-text-muted">
                      {getTakeawayElapsedMinutes(order.created_at)}m ago
                    </Text>
                  </View>
                  {order.customer_name && (
                    <Text className="mt-1 text-pos-sm text-pos-text-muted">
                      {order.customer_name}
                    </Text>
                  )}
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-pos-base font-semibold text-pos-text">
                      Rp {order.total.toLocaleString('id-ID')}
                    </Text>
                    <View className="rounded-full bg-amber-500/20 px-2 py-0.5">
                      <Text className="text-pos-xs text-amber-500">{order.status}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        ) : currentTables.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
              <Armchair size={32} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-base text-pos-text-muted">
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
                  onLongPress={() => handleTableLongPress(table)}
                  reservationName={(() => {
                    const tableId = toInt(table.id);
                    const res = getReservationsForTable(tableId)[0];
                    return res?.resolved_customer_name ?? null;
                  })()}
                  reservationTime={(() => {
                    const tableId = toInt(table.id);
                    const res = getReservationsForTable(tableId)[0];
                    return res ? formatReservationTime(res.reservation_datetime) : null;
                  })()}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Reservation Modal */}
      <ReservationModal
        visible={reservationTable !== null}
        table={reservationTable}
        onClose={() => setReservationTable(null)}
      />
    </View>
  );
}
