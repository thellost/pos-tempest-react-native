import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';

interface AdaptiveModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Width for centered dialog on tablet (default: 480) */
  tabletWidth?: number;
  /** Sticky content rendered below the scroll area (e.g. action bars) */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Adaptive modal that renders full-screen on phone and as a centered dialog on tablet.
 */
export function AdaptiveModal({
  visible,
  onClose,
  title,
  tabletWidth = 480,
  footer,
  children,
}: AdaptiveModalProps) {
  const { isPhone } = useLayout();

  if (isPhone) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
            keyboardVerticalOffset={0}
          >
            <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-3">
              {title ? (
                <Text className="text-pos-lg font-bold text-pos-text">{title}</Text>
              ) : (
                <View />
              )}
              <Pressable onPress={onClose} hitSlop={8} className="p-2">
                <X size={20} color={ThemeColors.text.muted} />
              </Pressable>
            </View>
            <ScrollView
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
            >
              {children}
            </ScrollView>
            {footer}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <Pressable
            className="overflow-hidden rounded-xl border border-border bg-surface-card"
            style={{
              width: tabletWidth,
              maxWidth: '95%',
              maxHeight: '90%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 16,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {title ? (
              <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
                <Text className="text-pos-lg font-bold text-pos-text">{title}</Text>
                <Pressable onPress={onClose} hitSlop={8} className="p-2">
                  <X size={20} color={ThemeColors.text.muted} />
                </Pressable>
              </View>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {children}
            </ScrollView>
            {footer}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
