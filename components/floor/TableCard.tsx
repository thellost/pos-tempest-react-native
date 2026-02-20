import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TABLE_STATUS } from '@/constants/enums';
import type { TableWithOrder } from '@/hooks/use-tables';

interface TableCardProps {
  table: TableWithOrder;
  elapsedMinutes: number;
  onPress: () => void;
}

/**
 * Card component for a single table.
 * Shows table number, capacity, status (color-coded), guest count,
 * current order total, and elapsed time since order opened.
 * 
 * Status colors:
 * - Green: Available
 * - Red: Occupied
 * - Yellow: Reserved
 * - Gray: Maintenance
 */
export function TableCard({ table, elapsedMinutes, onPress }: TableCardProps) {
  const isOccupied = table.status === TABLE_STATUS.OCCUPIED;
  const isAvailable = table.status === TABLE_STATUS.AVAILABLE;
  const isReserved = table.status === TABLE_STATUS.RESERVED;
  const isMaintenance = table.status === TABLE_STATUS.MAINTENANCE;

  // Determine background color based on status
  const statusColor = isAvailable 
    ? 'bg-green-600/20 border-green-600/40' 
    : isOccupied 
    ? 'bg-red-600/20 border-red-600/40'
    : isReserved 
    ? 'bg-yellow-600/20 border-yellow-600/40'
    : 'bg-gray-600/20 border-gray-600/40';

  // Badge color for status indicator
  const badgeColor = isAvailable 
    ? 'bg-green-600' 
    : isOccupied 
    ? 'bg-red-600'
    : isReserved 
    ? 'bg-yellow-600'
    : 'bg-gray-600';

  // Display status text
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
      className={`min-h-[120px] rounded-xl border-2 p-4 ${statusColor} ${
        isMaintenance ? 'opacity-50' : 'active:scale-95'
      }`}
    >
      {/* Header: Table Number & Status Badge */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-pos-2xl font-bold text-pos-text-strong">
          {table.table_number}
        </Text>
        <View className={`rounded-full px-3 py-1 ${badgeColor}`}>
          <Text className="text-pos-xs font-semibold text-white">
            {statusText}
          </Text>
        </View>
      </View>

      {/* Capacity */}
      <View className="mb-2 flex-row items-center">
        <Text className="text-pos-sm text-pos-muted">
          {`Capacity: ${table.capacity} ${table.capacity === 1 ? 'person' : 'people'}`}
        </Text>
      </View>

      {/* Active Order Info (if occupied) - Compact side-by-side layout */}
      <View className="min-h-[40px] border-t border-white/10 pt-2">
        {isOccupied && table.active_order_id ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-pos-xs text-pos-muted">
                {table.active_order_number}
              </Text>
            </View>
            {elapsedMinutes > 0 && (
              <Text 
                className={`text-pos-xs font-medium ${
                  elapsedMinutes > 90 
                    ? 'text-red-500' 
                    : elapsedMinutes > 60 
                    ? 'text-yellow-500' 
                    : 'text-pos-text-strong'
                }`}
              >
                {`${elapsedMinutes} min`}
              </Text>
            )}
          </View>
        ) : isReserved ? (
          <Text className="text-pos-xs text-yellow-400">
            Reserved - Tap for details
          </Text>
        ) : isMaintenance ? (
          <Text className="text-pos-xs text-gray-400">
            Under maintenance
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
