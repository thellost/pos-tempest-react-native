import type { LucideIcon } from 'lucide-react-native';
import {
    ChefHat,
    ClipboardList,
    DollarSign,
    LayoutGrid,
    MoreHorizontal,
} from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePathname, useRouter } from 'expo-router';

import { PERMISSION } from '@/constants/permissions';
import type { Permission } from '@/constants/permissions';
import { LightThemeColors, ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePermissions } from '@/hooks/use-permissions';

import { MoreSheet } from './MoreSheet';

interface PrimaryTab {
  label: string;
  icon: LucideIcon;
  href: string;
  permission?: Permission;
}

/** The fixed primary tabs — filtered by permission at render time. */
const PRIMARY_TABS: PrimaryTab[] = [
  { label: 'Floor',   icon: LayoutGrid,    href: '/(app)/floor' },
  { label: 'Orders',  icon: ClipboardList, href: '/(app)/daily-orders', permission: PERMISSION.VIEW_REPORTS },
  { label: 'Kitchen', icon: ChefHat,       href: '/(app)/kitchen' },
  { label: 'Cash',    icon: DollarSign,    href: '/(app)/shifts',       permission: PERMISSION.MANAGE_SHIFT },
];

interface NavTabButtonProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onPress: () => void;
  colors: typeof ThemeColors;
}

function NavTabButton({ label, icon: Icon, isActive, onPress, colors }: NavTabButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className="flex-1 items-center justify-center"
    >
      <Animated.View className="items-center" style={{ transform: [{ scale }] }}>
        <Icon
          size={22}
          color={isActive ? colors.accent.primary : colors.text.muted}
          strokeWidth={isActive ? 2.2 : 1.8}
        />
        <Text
          className="mt-0.5 text-pos-xs"
          style={{
            color: isActive ? colors.accent.primary : colors.text.muted,
            fontWeight: isActive ? '600' : '400',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

interface MoreTabButtonProps {
  onPress: () => void;
  colors: typeof ThemeColors;
}

function MoreTabButton({ onPress, colors }: MoreTabButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className="flex-1 items-center justify-center"
    >
      <Animated.View className="items-center" style={{ transform: [{ scale }] }}>
        <MoreHorizontal size={22} color={colors.text.muted} strokeWidth={1.8} />
        <Text
          className="mt-0.5 text-pos-xs"
          style={{ color: colors.text.muted }}
          numberOfLines={1}
        >
          More
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const { can } = usePermissions();
  const [moreVisible, setMoreVisible] = useState(false);
  const colors = isDark ? ThemeColors : LightThemeColors;

  const visibleTabs = useMemo(
    () => PRIMARY_TABS.filter((tab) => !tab.permission || can(tab.permission)),
    [can],
  );

  return (
    <>
      <View
        className="border-t border-border bg-surface-card"
        style={{ paddingBottom: insets.bottom }}
      >
        <View style={{ height: 56, flexDirection: 'row' }}>
          {visibleTabs.map((tab) => {
            const bare = tab.href.replace(/\/\([^)]+\)/g, '');
            const isActive =
              pathname === bare || pathname.startsWith(bare + '/');

            return (
              <NavTabButton
                key={tab.href}
                label={tab.label}
                icon={tab.icon}
                isActive={isActive}
                onPress={() => router.push(tab.href as Parameters<typeof router.push>[0])}
                colors={colors as any}
              />
            );
          })}

          <MoreTabButton onPress={() => setMoreVisible(true)} colors={colors as any} />
        </View>
      </View>

      <MoreSheet
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
      />
    </>
  );
}
