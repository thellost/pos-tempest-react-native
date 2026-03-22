import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { UserRow } from '@/hooks/use-auth';
import { getAppTimezone } from '@/utils/timezone';

interface StatusBarProps {
  user: UserRow | null;
  isShiftOpen: boolean;
  activeOrdersCount: number;
  deviceName: string;
  branchName: string;
}

function formatTime(): string {
  try {
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: getAppTimezone(),
    });
  } catch {
    return '--:--';
  }
}

export function AppStatusBar({
  user,
  isShiftOpen,
  activeOrdersCount,
  deviceName,
  branchName,
}: StatusBarProps) {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 60_000);
    return () => clearInterval(id);
  }, []);

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '??';

  return (
    <View className="h-11 flex-row items-center border-b border-border bg-surface-card px-4">
      {/* LEFT — user info */}
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-accent">
          <Text className="text-[11px] font-bold text-white">{initials}</Text>
        </View>
        <Text className="text-pos-base font-medium text-pos-text" numberOfLines={1}>
          {user?.name ?? 'Unknown'}
        </Text>
        {user?.role_name ? (
          <View className="rounded bg-accent-muted px-2 py-0.5">
            <Text className="text-pos-sm font-semibold uppercase tracking-wider text-accent">
              {user.role_name}
            </Text>
          </View>
        ) : null}
      </View>

      {/* CENTER — clock */}
      <View className="flex-1 items-center">
        <Text className="font-mono text-pos-base font-bold text-pos-text-muted">
          {time}
        </Text>
      </View>

      {/* RIGHT — shift, orders, device */}
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center gap-1.5">
          <View
            className={`h-2.5 w-2.5 rounded-full ${isShiftOpen ? 'bg-pos-success' : 'bg-pos-danger'}`}
          />
          <Text className="text-pos-base text-pos-text-muted">
            {isShiftOpen ? 'Shift: Open' : 'No Shift'}
          </Text>
        </View>

        <Text className="text-pos-base text-pos-text-faint">|</Text>

        <Text className="font-mono text-pos-base font-bold text-pos-text">
          {activeOrdersCount}
        </Text>
        <Text className="text-pos-base text-pos-text-faint">orders</Text>

        {(deviceName || branchName) && (
          <>
            <Text className="text-pos-base text-pos-text-faint">|</Text>
            <Text className="text-pos-base text-pos-text-faint" numberOfLines={1}>
              {[deviceName, branchName].filter(Boolean).join(' · ')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
