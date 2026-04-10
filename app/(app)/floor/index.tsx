import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';

import { router } from 'expo-router';
import { Armchair, MapPin, ShoppingBag } from 'lucide-react-native';

import { FloorAreaTabs } from '@/components/floor/FloorAreaTabs';
import { FloorStatsHeader } from '@/components/floor/FloorStatsHeader';
import { ReservationModal } from '@/components/floor/ReservationModal';
import { TableCard } from '@/components/floor/TableCard';
import { TakeawayOrderCard } from '@/components/floor/TakeawayOrderCard';
import { Button } from '@/components/ui';
import { TABLE_STATUS } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useReservations } from '@/hooks/use-reservations';
import { useShift } from '@/hooks/use-shift';
import { useTables, type TableWithOrder } from '@/hooks/use-tables';
import { useTakeaway, type TakeawayOrder } from '@/hooks/use-takeaway';
import { toInt } from '@/utils/coerce';

export default function FloorScreen() {
  const { isPhone } = useLayout();
  const cardWidth = isPhone ? 'w-[48%]' : 'w-[31%]';

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

  const handleTablePress = (tableId: number, activeOrderId: string | null, status: string) => {
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

      //default to api.zidan.id if EXPO_PUBLIC_API_URL is not defined, to prevent app from crashing when user tries to long press a table while offline
      const url = `${process.env.
         || 'https://api.zidan.id'}/health`;
      const res = await fetch(url, {
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
      <FloorStatsHeader
        availableTablesCount={availableTablesCount}
        occupiedTablesCount={occupiedTablesCount}
        reservedTablesCount={reservedTablesCount}
        totalTablesCount={totalTablesCount}
        onTakeawayPress={handleTakeawayPress}
        isPhone={isPhone}
      />

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
        contentContainerStyle={{ padding: 10 }}
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
                className="mt-4 rounded-sm bg-amber-500 px-6 py-3"
              >
                <Text className="text-pos-base font-bold text-white">Create Takeaway Order</Text>
              </Button>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {takeawayOrders.map((order) => (
                <TakeawayOrderCard
                  key={`takeaway-${order.id}`}
                  order={order}
                  cardWidth={cardWidth}
                  elapsedMinutes={`${getTakeawayElapsedMinutes(order.created_at)}m`}
                  onPress={() => handleTakeawayOrderPress(order)}
                />
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
          <View className="flex-row flex-wrap gap-3">
            {currentTables.map((table) => (
              <View key={`table-${table.id}`} className={cardWidth}>
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
