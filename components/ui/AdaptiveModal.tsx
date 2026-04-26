import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import {
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

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
 *
 * Keyboard handling: KeyboardAvoidingView is unreliable inside Android Modals
 * (the Modal window doesn't receive root window insets). Instead we:
 *  - track the visible keyboard height via Keyboard listeners
 *  - pad the bottom of the ScrollView content by that height + breathing room
 *  - on focus, ask the ScrollView responder to scroll the focused input
 *    above the keyboard
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
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);

  const contentPaddingBottom = (keyboardHeight > 0 ? keyboardHeight : 0) + 24;

  /**
   * Bubble-phase focus handler. RN forwards inner TextInput focus events up
   * through the view tree as `onFocus`, so we can scroll the focused input
   * into view from the ScrollView wrapper.
   */
  const handleFocusCapture = useCallback(() => {
    requestAnimationFrame(() => {
      const focused = TextInput.State.currentlyFocusedInput?.();
      const nodeHandle = focused ? findNodeHandle(focused as unknown as Parameters<typeof findNodeHandle>[0]) : null;
      const sv = scrollRef.current as unknown as {
        scrollResponderScrollNativeHandleToKeyboard?: (
          handle: number,
          additionalOffset: number,
          preventNegativeScrollOffset: boolean,
        ) => void;
      } | null;
      if (nodeHandle && sv?.scrollResponderScrollNativeHandleToKeyboard) {
        sv.scrollResponderScrollNativeHandleToKeyboard(nodeHandle, 120, true);
      }
    });
  }, []);

  if (isPhone) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <View className="flex-1">
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
            <View className="flex-1" onFocus={handleFocusCapture}>
              <ScrollView
                ref={scrollRef}
                className="flex-1"
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: contentPaddingBottom }}
              >
                {children}
              </ScrollView>
            </View>
            {footer}
          </View>
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
        <Pressable
          className="overflow-hidden rounded-xl border border-border bg-surface-card"
          style={{
            width: tabletWidth,
            maxWidth: '95%',
            maxHeight: '90%',
            flexDirection: 'column',
            // Lift the centered dialog so it stays inside the visible region
            // (above the keyboard) rather than being centered on the full screen.
            marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
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
          {/* flex: 1 + minHeight: 0 ensures the scroll area shrinks to fit
              within the dialog's maxHeight cap instead of overflowing it. */}
          <View style={{ flex: 1, minHeight: 0 }} onFocus={handleFocusCapture}>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
            >
              {children}
            </ScrollView>
          </View>
          {footer}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
