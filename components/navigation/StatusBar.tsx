import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserRow } from '@/hooks/use-auth';
import { getAppTimezone } from '@/utils/timezone';

interface StatusBarProps {
  user: UserRow | null;
  isShiftOpen: boolean;
  activeOrdersCount: number;
  deviceName: string;
  branchName: string;
  /** Compact mode for phones: reduced height, hides secondary info */
  compact?: boolean;
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
  compact = false,
}: StatusBarProps) {
  const [time, setTime] = useState(formatTime);
  const insets = useSafeAreaInsets();

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

  if (compact) {
    return (
      <View
        className="flex-row items-center border-b border-border bg-surface-card px-3"
        style={{ paddingTop: insets.top, minHeight: 36 + insets.top }}>
        {/* LEFT — avatar + name */}
        <View className="flex-row items-center gap-1.5" style={{ flexShrink: 0 }}>
          <View className="h-6 w-6 items-center justify-center rounded-full bg-accent" style={{ flexShrink: 0 }}>
            <Text className="text-[9px] font-bold text-white">{initials}</Text>
          </View>
          <Text className="text-pos-xs font-medium text-pos-text" numberOfLines={1} style={{ maxWidth: 80 }}>
            {user?.name ?? 'Unknown'}
          </Text>
        </View>

        {/* CENTER — clock */}
        <View className="flex-1 items-center">
          <Text className="font-mono text-pos-sm font-bold text-pos-text-muted">
            {time}
          </Text>
        </View>

        {/* RIGHT — auto-shift status dot */}
        <View className="items-center justify-center" style={{ flexShrink: 0 }}>
          <View
            className={`h-2.5 w-2.5 rounded-full ${isShiftOpen ? 'bg-pos-success' : 'bg-pos-text-muted'}`}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center border-b border-border bg-surface-card px-4"
      style={{ paddingTop: insets.top, minHeight: 44 + insets.top }}>
      {/* LEFT — user info */}
      <View className="shrink flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-accent" style={{ flexShrink: 0 }}>
          <Text className="text-[11px] font-bold text-white">{initials}</Text>
        </View>
        <Text className="shrink text-pos-sm font-medium text-pos-text" numberOfLines={1}>
          {user?.name ?? 'Unknown'}
        </Text>
        {user?.role_name ? (
          <View className="shrink-0 rounded bg-accent-muted px-2 py-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-accent" numberOfLines={1}>
              {user.role_name}
            </Text>
          </View>
        ) : null}
      </View>

      {/* CENTER — clock */}
      <View className="shrink-0 items-center px-2">
        <Text className="font-mono text-pos-base font-bold text-pos-text-muted">
          {time}
        </Text>
      </View>

      {/* RIGHT — auto-shift, orders, device */}
      <View className="shrink flex-row items-center justify-end gap-2">
        <View className="shrink-0 flex-row items-center gap-1.5">
          <View
            className={`h-2.5 w-2.5 rounded-full ${isShiftOpen ? 'bg-pos-success' : 'bg-pos-text-muted'}`}
          />
          <Text className="text-pos-sm text-pos-text-muted" numberOfLines={1}>
            {isShiftOpen ? 'Shift: Open' : 'Shift: Pending'}
          </Text>
        </View>

        <Text className="shrink-0 text-pos-sm text-pos-text-faint">|</Text>

        <Text className="shrink-0 font-mono text-pos-sm font-bold text-pos-text">
          {activeOrdersCount}
        </Text>
        <Text className="shrink-0 text-pos-sm text-pos-text-faint">orders</Text>

        {(deviceName || branchName) && (
          <>
            <Text className="shrink-0 text-pos-sm text-pos-text-faint">|</Text>
            <Text
              className="shrink text-pos-sm text-pos-text-faint"
              numberOfLines={1}
            >
              {[deviceName, branchName].filter(Boolean).join(' · ')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
