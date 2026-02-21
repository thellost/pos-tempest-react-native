import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TABLE_STATUS } from '@/constants/enums';
import type { TableWithOrder } from '@/hooks/use-tables';

interface TableCardProps {
  table: TableWithOrder;
  elapsedMinutes: number;
  onPress: () => void;
}

export function TableCard({ table, elapsedMinutes, onPress }: TableCardProps) {
  const isOccupied = table.status === TABLE_STATUS.OCCUPIED;
  const isAvailable = table.status === TABLE_STATUS.AVAILABLE;
  const isReserved = table.status === TABLE_STATUS.RESERVED;
  const isMaintenance = table.status === TABLE_STATUS.MAINTENANCE;

  const statusBgColor = isAvailable 
    ? 'bg-status-available-muted border-status-available/30' 
    : isOccupied 
    ? 'bg-status-occupied-muted border-status-occupied/30'
    : isReserved 
    ? 'bg-status-reserved-muted border-status-reserved/30'
    : 'bg-status-maintenance-muted border-status-maintenance/30';

  const badgeBgColor = isAvailable 
    ? 'bg-status-available' 
    : isOccupied 
    ? 'bg-status-occupied'
    : isReserved 
    ? 'bg-status-reserved'
    : 'bg-status-maintenance';

  const statusText = isAvailable 
    ? 'Available' 
    : isOccupied 
    ? 'Occupied'
    : isReserved 
    ? 'Reserved'
    : 'Maintenance';

  return (
    <Pressable
      onPress={onPress}
      disabled={isMaintenance}
      className={`min-h-[130px] overflow-hidden rounded-2xl border-2 p-5 ${statusBgColor} ${
        isMaintenance ? 'opacity-50' : ''
      }`}
      style={{ 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-pos-2xl font-bold text-pos-text">
          {table.table_number}
        </Text>
        <View className={`rounded-full px-3 py-1.5 ${badgeBgColor}`}>
          <Text className="text-pos-xs font-semibold text-white">
            {statusText}
          </Text>
        </View>
      </View>

      <View className="mb-3 flex-row items-center">
        <Text className="text-pos-sm text-pos-text-muted">
          {`Capacity: ${table.capacity} ${table.capacity === 1 ? 'person' : 'people'}`}
        </Text>
      </View>

      <View className="min-h-[40px] border-t border-border pt-3">
        {isOccupied && table.active_order_id ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-pos-xs text-pos-text-muted">
                {table.active_order_number}
              </Text>
            </View>
            {elapsedMinutes > 0 && (
              <Text 
                className={`text-pos-xs font-semibold ${
                  elapsedMinutes > 90 
                    ? 'text-pos-danger' 
                    : elapsedMinutes > 60 
                    ? 'text-pos-warning' 
                    : 'text-pos-text'
                }`}
              >
                {`${elapsedMinutes} min`}
              </Text>
            )}
          </View>
        ) : isReserved ? (
          <Text className="text-pos-xs text-pos-warning">
            Reserved - Tap for details
          </Text>
        ) : isMaintenance ? (
          <Text className="text-pos-xs text-pos-text-faint">
            Under maintenance
          </Text>
        ) : (
          <Text className="text-pos-xs text-pos-success">
            Tap to start order
          </Text>
        )}
      </View>
    </Pressable>
  );
}
