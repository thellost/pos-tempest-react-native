import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';

import { AdaptiveModal } from '@/components/ui/AdaptiveModal';
import { TABLE_STATUS } from '@/constants/enums';
import type { FloorArea } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { type TableWithOrder, useTables } from '@/hooks/use-tables';
import { moveOrderToTable } from '@/services/order.service';
import { toInt } from '@/utils/coerce';

interface MoveTableModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  currentTableId: number;
  branchId: number;
  /** Called with new tableId after successful move */
  onMoved: (newTableId: number) => void;
}

interface AreaSection {
  area: FloorArea;
  tables: TableWithOrder[];
}

export function MoveTableModal({
  visible,
  onClose,
  orderId,
  currentTableId,
  branchId,
  onMoved,
}: MoveTableModalProps) {
  const { user } = useAuth();
  const { tables, floorAreas } = useTables();
  const [isMoving, setIsMoving] = useState(false);

  const availableTables = tables.filter(
    (t) =>
      t.status === TABLE_STATUS.AVAILABLE &&
      toInt(t.id) !== currentTableId &&
      // is_active is typed boolean but SQLite may return 0/1
      (t.is_active === true || (t.is_active as unknown as number) === 1) &&
      toInt(t.branch_id) === branchId,
  );

  const tablesByAreaId = availableTables.reduce<Record<number, TableWithOrder[]>>((acc, table) => {
    const areaId = toInt(table.floor_area_id);
    if (!acc[areaId]) acc[areaId] = [];
    acc[areaId].push(table);
    return acc;
  }, {});

  const sections: AreaSection[] = floorAreas
    .filter((area) => (tablesByAreaId[toInt(area.id)]?.length ?? 0) > 0)
    .map((area) => ({ area, tables: tablesByAreaId[toInt(area.id)] }));

  const handleTablePress = useCallback(
    (table: TableWithOrder) => {
      if (isMoving) return;
      Alert.alert('Move Table', `Move order to Table ${table.table_number}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setIsMoving(true);
            try {
              await moveOrderToTable(
                orderId,
                currentTableId,
                toInt(table.id),
                toInt(user.id),
                branchId,
              );
              onMoved(toInt(table.id));
              onClose();
            } catch (error) {
              console.error('[MoveTableModal] Failed to move table:', error);
              Alert.alert('Error', 'Failed to move table. Please try again.');
            } finally {
              setIsMoving(false);
            }
          },
        },
      ]);
    },
    [isMoving, user, orderId, currentTableId, branchId, onMoved, onClose],
  );

  return (
    <AdaptiveModal visible={visible} onClose={onClose} title="Move Table" tabletWidth={560}>
      {isMoving && (
        <View className="flex-row items-center justify-center gap-2 border-b border-border py-2">
          <ActivityIndicator size="small" />
          <Text className="text-pos-sm text-pos-text-muted">Moving...</Text>
        </View>
      )}
      {sections.length === 0 ? (
        <View className="items-center px-4 py-10">
          <Text className="text-pos-base text-pos-text-muted">No available tables</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => String(toInt(item.area.id))}
          scrollEnabled={false}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View>
              <Text className="mb-2 mt-3 text-pos-xs font-semibold uppercase tracking-wider text-pos-text-muted">
                {item.area.name}
              </Text>
              {/* Disable all touch when a move is in progress */}
              <View
                className="flex-row flex-wrap"
                pointerEvents={isMoving ? 'none' : 'auto'}
              >
                {item.tables.map((table) => (
                  <View key={toInt(table.id)} className="w-1/3 p-1">
                    <Pressable
                      onPress={() => handleTablePress(table)}
                      className={`min-h-[64px] items-center justify-center rounded-lg border border-border bg-surface-card py-3${isMoving ? ' opacity-50' : ''}`}
                    >
                      <Text className="text-pos-lg font-bold text-pos-text">
                        {table.table_number}
                      </Text>
                      <Text className="text-pos-xs text-pos-text-muted">
                        {table.capacity} seats
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </AdaptiveModal>
  );
}
