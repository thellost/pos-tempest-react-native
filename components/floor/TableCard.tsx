import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TABLE_STATUS } from '@/constants/enums';
import type { TableWithOrder } from '@/hooks/use-tables';

interface TableCardProps {
  table: TableWithOrder;
  elapsedMinutes: number;
  onPress: () => void;
  onLongPress?: () => void;
  reservationName?: string | null;
  reservationTime?: string | null;
}

export function TableCard({ table, elapsedMinutes, onPress, onLongPress, reservationName, reservationTime }: TableCardProps) {
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
  const customerName = table.active_order_customer_name?.trim();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      disabled={isMaintenance}
      className={`overflow-hidden rounded-sm border px-3 py-2 ${statusBgColor} ${
        isMaintenance ? 'opacity-50' : ''
      }`}
    >
      {/* Row 1: Table number [capacity] + status badge */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-mono text-pos-lg font-bold text-pos-text">
            {table.table_number}
          </Text>
          <Text className="font-mono text-pos-xs text-pos-text-faint">
            [{table.capacity}]
          </Text>
        </View>
        <View className={`rounded px-2 py-0.5 ${badgeBgColor}`}>
          <Text className="text-pos-xs font-bold text-white">
            {statusText}
          </Text>
        </View>
      </View>

      {/* Row 2: Order info / reservation / action */}
      <View className="mt-1">
        {isOccupied && table.active_order_id ? (
          <View className="gap-0.5">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="shrink font-mono text-pos-xs text-pos-text-muted" numberOfLines={1}>
                {table.active_order_number}
              </Text>
              {elapsedMinutes > 0 && (
                <Text
                  className={`shrink-0 font-mono text-pos-xs font-bold ${
                    elapsedMinutes > 90
                      ? 'text-pos-danger'
                      : elapsedMinutes > 60
                      ? 'text-pos-warning'
                      : 'text-pos-text-muted'
                  }`}
                >
                  {elapsedMinutes >= 60
                    ? `${Math.floor(elapsedMinutes / 60)}h${elapsedMinutes % 60}m`
                    : `${elapsedMinutes}m`}
                </Text>
              )}
            </View>
            {customerName ? (
              <Text className="text-pos-xs font-semibold text-pos-text" numberOfLines={1}>
                {customerName}
              </Text>
            ) : null}
          </View>
        ) : isReserved ? (
          <View className="flex-row items-center justify-between gap-2">
            <Text className="shrink text-pos-xs font-semibold text-pos-warning" numberOfLines={1}>
              {reservationName || 'Reserved'}
            </Text>
            {reservationTime ? (
              <Text className="shrink-0 font-mono text-pos-xs text-pos-text-muted">{reservationTime}</Text>
            ) : null}
          </View>
        ) : isMaintenance ? (
          <Text className="text-pos-xs text-pos-text-faint">Maintenance</Text>
        ) : (
          <Text className="text-pos-xs font-medium text-pos-success">+ New Order</Text>
        )}
      </View>
    </Pressable>
  );
}
