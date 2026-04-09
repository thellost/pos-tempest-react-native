import { LightThemeColors, ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
} from 'react-native';
import { RowDivider } from './primitives';
import { withPressedOpacity } from '@/utils/pressable-style';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export function AccordionSection({
  icon: Icon,
  title,
  summary,
  danger = false,
  children,
  defaultOpen = false,
}: {
  icon: LucideIcon;
  title: string;
  summary?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { isDark } = useAppTheme();
  const C = isDark ? ThemeColors : LightThemeColors;

  const [open, setOpen] = useState(defaultOpen);
  const chevron = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    Animated.timing(chevron, { toValue: open ? 0 : 1, duration: 220, useNativeDriver: true }).start();
    setOpen((prev) => !prev);
  };

  const rotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View
      className={`mb-2 overflow-hidden rounded-2xl bg-surface-card border ${
        danger ? 'border-pos-danger/20' : 'border-border'
      }`}
    >
      <Pressable
        onPress={toggle}
        style={({ pressed }) => withPressedOpacity(pressed)}
        className="flex-row items-center gap-3 px-4 py-3.5"
      >
        <View
          className={`h-8 w-8 items-center justify-center rounded-xl ${
            danger ? 'bg-pos-danger-muted' : 'bg-accent-muted'
          }`}
        >
          <Icon size={15} color={danger ? C.danger.DEFAULT : C.accent.primary} />
        </View>
        <Text className="flex-1 text-pos-sm font-semibold text-pos-text">{title}</Text>
        {summary && !open && <View className="mr-1.5">{summary}</View>}
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronRight size={14} color={C.text.faint} />
        </Animated.View>
      </Pressable>
      {open && (
        <>
          <RowDivider />
          <View className="p-4">{children}</View>
        </>
      )}
    </View>
  );
}
