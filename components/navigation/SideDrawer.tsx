import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui';

import { router, usePathname } from 'expo-router';
import {
  BarChart2,
  Banknote,
  CalendarDays,
  ChefHat,
  DollarSign,
  LayoutGrid,
  Lock,
  LogOut,
  Monitor,
  Package,
  Settings,
  Store,
  Tablet,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { UserRow } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { useShift } from '@/hooks/use-shift';
import { ThemeColors } from '@/constants/theme';

const DRAWER_WIDTH = 280;

// ─── Navigation item definition ──────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles?: string[]; // if set, only shown to these roles
}

const MAIN_NAV: NavItem[] = [
  { label: 'Tables & Orders', icon: LayoutGrid,   href: '/(app)/floor' },
  { label: 'Reservations',    icon: CalendarDays, href: '/(app)/reservations' },
  { label: 'Kitchen Display', icon: ChefHat,      href: '/(app)/kitchen' },
  { label: 'Inventory',       icon: Package,      href: '/(app)/inventory' },
  { label: 'Customers',       icon: Users,      href: '/(app)/customers' },
  {
    label: 'Reports',
    icon: BarChart2,
    href: '/(app)/reports',
    roles: ['admin', 'manager'],
  },
];

const SYSTEM_NAV: NavItem[] = [
  { label: 'Shift',     icon: DollarSign, href: '/(app)/shifts' },
  { label: 'Settings',  icon: Settings,   href: '/(app)/settings' },
  { label: 'Dashboard', icon: Monitor,    href: '/(tabs)/explore' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface NavRowProps {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
}

function NavRow({ item, isActive, onPress }: NavRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`relative mb-0.5 flex-row items-center rounded-lg px-3 py-3 active:bg-surface-elevated ${
        isActive ? 'bg-accent-muted' : ''
      }`}
    >
      {/* Active indicator bar */}
      {isActive && (
        <View className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-brand" />
      )}
      <View className="mr-3">
        <item.icon size={18} color={isActive ? ThemeColors.accent.primary : ThemeColors.text.muted} />
      </View>
      <Text
        className={`text-pos-sm font-medium ${
          isActive ? 'text-brand' : 'text-pos-text'
        }`}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-pos-text-faint">
      {label}
    </Text>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SideDrawerProps {
  isOpen: boolean;
  user: UserRow | null;
  onClose: () => void;
  onSignOut: () => void;
  onLock: () => void;
}

/**
 * Slide-in side navigation drawer.
 * Animates from the left, dims the rest of the screen with a pressable overlay.
 * All colours are pulled from the existing NativeWind theme tokens.
 */
export function SideDrawer({
  isOpen,
  user,
  onClose,
  onSignOut,
  onLock,
}: SideDrawerProps) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();
  const { registration } = useDevice();
  const { isShiftOpen } = useShift();

  const visibleSystemNav = useMemo(() => {
    const items = [...SYSTEM_NAV];
    if (isShiftOpen) {
      const shiftIndex = items.findIndex((i) => i.href === '/(app)/shifts');
      items.splice(shiftIndex + 1, 0, { label: 'Cash', icon: Banknote, href: '/(app)/cash' });
    }
    return items;
  }, [isShiftOpen]);

  // Animate open / close
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, translateX, overlayOpacity]);

  /** Navigate to a screen and close the drawer */
  const navigate = (href: string) => {
    onClose();
    // Small delay lets the close animation start before pushing
    setTimeout(() => router.push(href as Parameters<typeof router.push>[0]), 80);
  };

  /** Filter nav items by user role */
  const visibleMainNav = MAIN_NAV.filter((item) => {
    if (!item.roles) return true;
    const role = user?.role_name?.toLowerCase() ?? '';
    return item.roles.includes(role);
  });

  // User initials for avatar bubble
  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '??';

  const deviceName = registration?.device?.device_name ?? null;
  const branchName = registration?.branch?.name ?? null;

  // Don't render anything if completely hidden and animation has finished
  if (!isOpen) {
    // Still render so the close animation can play; pointer events are blocked
    // by pointerEvents="none" on the overlay when closed.
  }

  return (
    // Full-screen container — sits on top of everything
    <View
      className="absolute inset-0 z-50"
      pointerEvents={isOpen ? 'auto' : 'none'}
    >
      {/* Dimmed overlay — tap to dismiss */}
      <Animated.View
        style={{ opacity: overlayOpacity }}
        className="absolute inset-0 bg-black/60"
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          width: DRAWER_WIDTH,
        }}
        className="absolute bottom-0 top-0 left-0 border-r border-border bg-surface-card"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── User header ───────────────────────────── */}
          <View className="border-b border-border px-4 pb-4 pt-5">
            <View className="flex-row items-center gap-3">
              {/* Avatar bubble */}
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand">
                <Text className="text-pos-sm font-bold text-white">{initials}</Text>
              </View>

              <View className="flex-1">
                <Text
                  className="text-pos-base font-semibold text-pos-text"
                  numberOfLines={1}
                >
                  {user?.name ?? 'Unknown User'}
                </Text>
                {/* Role badge */}
                {user?.role_name ? (
                  <View className="mt-0.5 self-start rounded-full bg-accent-muted px-2 py-0.5">
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                      {user.role_name}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Branch / device info */}
            {(branchName || deviceName) ? (
              <View className="mt-3 rounded-lg bg-surface-raised px-3 py-2">
                {branchName ? (
                  <View className="flex-row items-center gap-1.5">
                    <Store size={11} color={ThemeColors.text.muted} />
                    <Text className="text-pos-xs text-pos-text-muted">{branchName}</Text>
                  </View>
                ) : null}
                {deviceName ? (
                  <View className="mt-0.5 flex-row items-center gap-1.5">
                    <Tablet size={11} color={ThemeColors.text.muted} />
                    <Text className="text-pos-xs text-pos-text-muted">{deviceName}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* ── Main navigation ───────────────────────── */}
          <View className="px-3 pt-2">
            <SectionLabel label="Navigation" />
            {visibleMainNav.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                onPress={() => navigate(item.href)}
              />
            ))}

            {/* ── System ────────────────────────────── */}
            <SectionLabel label="System" />
            {visibleSystemNav.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                onPress={() => navigate(item.href)}
              />
            ))}
          </View>
        </ScrollView>

        {/* ── Footer actions ────────────────────────── */}
        <View className="border-t border-border px-3 pb-4 pt-3">
          {/* Lock screen */}
          <Pressable
            onPress={() => {
              onClose();
              setTimeout(onLock, 80);
            }}
            className="mb-1.5 flex-row items-center rounded-lg px-3 py-3 active:bg-surface-elevated"
          >
            <View className="mr-3">
              <Lock size={18} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-sm font-medium text-pos-text-muted">
              Lock Screen
            </Text>
          </Pressable>

          {/* Sign out */}
          <Button
            onPress={() => {
              onClose();
              setTimeout(onSignOut, 80);
            }}
            className="flex-row items-center rounded-lg bg-pos-danger-muted px-3 py-3"
          >
            <View className="mr-3">
              <LogOut size={18} color={ThemeColors.danger.DEFAULT} />
            </View>
            <Text className="text-pos-sm font-semibold text-pos-danger">
              Sign Out
            </Text>
          </Button>
        </View>
      </Animated.View>
    </View>
  );
}
