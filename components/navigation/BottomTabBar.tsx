import {
  ChefHat,
  ClipboardList,
  DollarSign,
  LayoutGrid,
  MoreHorizontal,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePathname, useRouter } from 'expo-router';

import { LightThemeColors, ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

import { MoreSheet } from './MoreSheet';

interface PrimaryTab {
  label: string;
  icon: LucideIcon;
  href: string;
}

/** The 4 fixed primary tabs (+ More as 5th). */
const PRIMARY_TABS: PrimaryTab[] = [
  { label: 'Floor',   icon: LayoutGrid,    href: '/(app)/floor' },
  { label: 'Orders',  icon: ClipboardList, href: '/(app)/daily-orders' },
  { label: 'Kitchen', icon: ChefHat,       href: '/(app)/kitchen' },
  { label: 'Shifts',  icon: DollarSign,    href: '/(app)/shifts' },
];

interface BottomTabBarProps {
  isShiftOpen: boolean;
}

export function BottomTabBar({ isShiftOpen }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const [moreVisible, setMoreVisible] = useState(false);
  const colors = isDark ? ThemeColors : LightThemeColors;

  return (
    <>
      <View
        className="border-t border-border bg-surface-card"
        style={{ paddingBottom: insets.bottom }}
      >
        <View style={{ height: 56, flexDirection: 'row' }}>
          {PRIMARY_TABS.map((tab) => {
            const bare = tab.href.replace(/\/\([^)]+\)/g, '');
            const isActive =
              pathname === bare || pathname.startsWith(bare + '/');

            return (
              <Pressable
                key={tab.href}
                onPress={() => router.push(tab.href as Parameters<typeof router.push>[0])}
                className="flex-1 items-center justify-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <tab.icon
                  size={22}
                  color={
                    isActive
                      ? colors.accent.primary
                      : colors.text.muted
                  }
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <Text
                  className="mt-0.5 text-pos-xs"
                  style={{
                    color: isActive
                      ? colors.accent.primary
                      : colors.text.muted,
                    fontWeight: isActive ? '600' : '400',
                  }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}

          {/* More tab */}
          <Pressable
            onPress={() => setMoreVisible(true)}
            className="flex-1 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MoreHorizontal
              size={22}
              color={colors.text.muted}
              strokeWidth={1.8}
            />
            <Text
              className="mt-0.5 text-pos-xs"
              style={{ color: colors.text.muted }}
              numberOfLines={1}
            >
              More
            </Text>
          </Pressable>
        </View>
      </View>

      <MoreSheet
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        isShiftOpen={isShiftOpen}
      />
    </>
  );
}
