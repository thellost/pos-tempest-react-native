import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Lock, LogOut } from 'lucide-react-native';

import type { NavItem } from '@/constants/navigation';
import { ThemeColors } from '@/constants/theme';
import type { UserRow } from '@/hooks/use-auth';

interface IconRailProps {
  navItems: NavItem[];
  currentPath: string;
  onNavigate: (href: string) => void;
  user: UserRow | null;
  userRole: string;
  isShiftOpen: boolean;
  onLock: () => void;
  onSignOut: () => void;
}

export function IconRail({
  navItems,
  currentPath,
  onNavigate,
  user,
  userRole,
  isShiftOpen,
  onLock,
  onSignOut,
}: IconRailProps) {
  const visibleItems = useMemo(() => {
    return navItems.filter((item) => {
      // Hide Cash when shift is closed
      if (item.href === '/(app)/cash' && !isShiftOpen) return false;
      // Role-gate
      if (item.roles && !item.roles.includes(userRole)) return false;
      return true;
    });
  }, [navItems, userRole, isShiftOpen]);

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '??';

  return (
    <View className="w-14 border-r border-border bg-surface-card">
      {/* Nav items */}
      <View className="flex-1 pt-1">
        {visibleItems.map((item) => {
          const isActive =
            currentPath === item.href ||
            currentPath.startsWith(item.href + '/');

          return (
            <Pressable
              key={item.href}
              onPress={() => onNavigate(item.href)}
              className={`h-12 w-full items-center justify-center active:scale-95 active:bg-surface-raised ${isActive ? 'bg-accent-muted' : ''}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              {isActive && (
                <View className="absolute left-0 h-6 w-0.5 rounded-r-full bg-accent" />
              )}
              <item.icon
                size={20}
                color={
                  isActive
                    ? ThemeColors.accent.primary
                    : ThemeColors.text.muted
                }
              />
            </Pressable>
          );
        })}
      </View>

      {/* Bottom actions */}
      <View className="items-center border-t border-border pb-2 pt-2">
        {/* User avatar */}
        <View className="mb-2 h-8 w-8 items-center justify-center rounded-full bg-accent">
          <Text className="text-[9px] font-bold text-white">{initials}</Text>
        </View>

        {/* Lock */}
        <Pressable
          onPress={onLock}
          className="mb-1 h-10 w-full items-center justify-center active:scale-95 active:bg-surface-raised"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Lock size={18} color={ThemeColors.text.muted} />
        </Pressable>

        {/* Sign out */}
        <Pressable
          onPress={onSignOut}
          className="h-10 w-full items-center justify-center active:scale-95 active:bg-surface-raised"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <LogOut size={18} color={ThemeColors.danger.DEFAULT} />
        </Pressable>
      </View>
    </View>
  );
}
