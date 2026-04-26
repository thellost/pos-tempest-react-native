import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  findNodeHandle,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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

/** Simulated gradient fade overlay at top or bottom of a scroll area.
 *  Uses a power-easing opacity curve across 16 thin slices for a smooth look
 *  without requiring react-native-linear-gradient. */
function ScrollFade({ position, color }: { position: 'top' | 'bottom'; color: string }) {
  const steps = 16;
  const height = 48;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height,
        ...(position === 'bottom' ? { bottom: 0 } : { top: 0 }),
        // Reverse slice order so slice 0 (transparent) is at the content edge
        flexDirection: position === 'bottom' ? 'column' : 'column-reverse',
      }}
    >
      {Array.from({ length: steps }).map((_, i) => {
        // Cubic ease-in: transparent at content edge → opaque at boundary
        const t = i / (steps - 1);
        const opacity = Math.pow(t, 2.5) * 0.9;
        return <View key={i} style={{ flex: 1, backgroundColor: color, opacity }} />;
      })}
    </View>
  );
}

interface ScrollFadeState {
  canScrollUp: boolean;
  canScrollDown: boolean;
}

function useScrollFade(visible: boolean) {
  const [fade, setFade] = useState<ScrollFadeState>({ canScrollUp: false, canScrollDown: false });
  const metrics = useRef({ contentH: 0, layoutH: 0, scrollY: 0 });

  useEffect(() => {
    if (!visible) {
      setFade({ canScrollUp: false, canScrollDown: false });
      metrics.current = { contentH: 0, layoutH: 0, scrollY: 0 };
    }
  }, [visible]);

  const update = useCallback(() => {
    const { contentH, layoutH, scrollY } = metrics.current;
    setFade({
      canScrollUp: scrollY > 6,
      canScrollDown: contentH > layoutH + 6 && scrollY + layoutH < contentH - 6,
    });
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    metrics.current.scrollY = contentOffset.y;
    metrics.current.contentH = contentSize.height;
    metrics.current.layoutH = layoutMeasurement.height;
    update();
  }, [update]);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    metrics.current.contentH = h;
    update();
  }, [update]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    metrics.current.layoutH = e.nativeEvent.layout.height;
    update();
  }, [update]);

  return { fade, onScroll, onContentSizeChange, onLayout };
}

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
  const { fade, onScroll, onContentSizeChange, onLayout } = useScrollFade(visible);

  const contentPaddingBottom = (keyboardHeight > 0 ? keyboardHeight : 0) + 24;

  // Surface colors for the fade overlays — must match the modal background
  const phoneFadeColor = ThemeColors.surfaces.base;       // bg-surface  (#0C0F14)
  const tabletFadeColor = ThemeColors.surfaces.card;      // bg-surface-card (#1A1F2C)

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
                onScroll={onScroll}
                onContentSizeChange={onContentSizeChange}
                onLayout={onLayout}
                scrollEventThrottle={16}
              >
                {children}
              </ScrollView>
              {fade.canScrollUp && <ScrollFade position="top" color={phoneFadeColor} />}
              {fade.canScrollDown && <ScrollFade position="bottom" color={phoneFadeColor} />}
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
          {/* flexShrink: 1 lets this area grow with content by default,
              and shrink when the dialog hits its maxHeight cap — making
              the ScrollView scrollable. Using flex:1 (flexBasis:0) caused
              0-height because the parent Pressable has no explicit height. */}
          <View style={{ flexShrink: 1 }} onFocus={handleFocusCapture}>
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
              onScroll={onScroll}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
              scrollEventThrottle={16}
            >
              {children}
            </ScrollView>
            {fade.canScrollUp && <ScrollFade position="top" color={tabletFadeColor} />}
            {fade.canScrollDown && <ScrollFade position="bottom" color={tabletFadeColor} />}
          </View>
          {footer}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
