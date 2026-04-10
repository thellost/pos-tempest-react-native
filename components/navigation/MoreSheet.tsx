import {
  Banknote,
  CalendarDays,
  ChefHat,
  ClipboardList,
  DollarSign,
  Lock,
  LogOut,
  Package,
  Settings,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import type { NavItem } from '@/constants/navigation';
import { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

const MORE_ITEMS: NavItem[] = [
  { label: 'Cash',         icon: Banknote,       href: '/(app)/cash' },
  { label: 'Inventory',    icon: Package,        href: '/(app)/inventory' },
  { label: 'Customers',    icon: Users,          href: '/(app)/customers' },
  { label: 'Reservations', icon: CalendarDays,   href: '/(app)/reservations' },
  { label: 'Daily Orders', icon: ClipboardList,  href: '/(app)/daily-orders' },
  { label: 'Kitchen',      icon: ChefHat,        href: '/(app)/kitchen' },
  { label: 'Shifts',       icon: DollarSign,     href: '/(app)/shifts' },
  { label: 'Menu',         icon: UtensilsCrossed, href: '/(app)/menu' },
  { label: 'Settings',     icon: Settings,       href: '/(app)/settings' },
];

interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
  isShiftOpen: boolean;
}

export function MoreSheet({ visible, onClose, isShiftOpen }: MoreSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, lock } = useAuth();
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const navigate = (href: string) => {
    onClose();
    router.push(href as Parameters<typeof router.push>[0]);
  };

  const visibleItems = MORE_ITEMS.filter((item) => {
    if (item.href === '/(app)/cash' && !isShiftOpen) return false;
    return true;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
          <View style={styles.backdrop} />
        </Pressable>

        {/* Sheet */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Drag handle */}
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pb-3">
            <Text className="text-pos-base font-semibold text-pos-text">More</Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-surface-soft"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <X size={16} color={ThemeColors.text.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Nav items grid */}
            <View className="flex-row flex-wrap px-4 pb-2">
              {visibleItems.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => navigate(item.href)}
                  className="mb-4 w-1/4 items-center gap-1.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <View className="h-14 w-14 items-center justify-center rounded-xl bg-surface-soft">
                    <item.icon size={24} color={ThemeColors.text.muted} strokeWidth={1.8} />
                  </View>
                  <Text
                    className="text-center text-pos-xs text-pos-text-muted"
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Footer: lock + sign out */}
            <View
              className="mx-4 flex-row gap-3 border-t border-border pb-3 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              <Pressable
                onPress={() => {
                  onClose();
                  lock();
                }}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surface-soft py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Lock size={18} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">Lock</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  onClose();
                  await signOut();
                }}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surface-soft py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <LogOut size={18} color={ThemeColors.danger.DEFAULT} />
                <Text className="text-pos-sm text-pos-danger">Sign Out</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: ThemeColors.surfaces.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
});
