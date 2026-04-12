import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { MenuSearchBar } from '@/components/menu/MenuSearchBar';
import { OrderPanel } from '@/components/order/OrderPanel';
import { toInt } from '@/utils/coerce';
import { PerfProfiler } from '@/utils/perf-debug';

import type { OrderScreenSharedProps } from './order-screen-props';

type ActiveTab = 'menu' | 'cart';

/**
 * Full-screen phone layout with tab-based switching between Menu and Cart.
 *
 * Structure:
 *   ┌─────────────────────┐
 *   │ Title  ·  n items   │  compact header
 *   ├─────────────────────┤
 *   │   [Tab content]     │  flex-1 — full-width menu or order panel
 *   ├─────────────────────┤
 *   │  [Menu]  [Cart(n)]  │  sticky tab switcher
 *   └─────────────────────┘
 */
export function OrderScreenPhone({
  title,
  order,
  itemsForPanel,
  pendingRoundItemsDisplay,
  guestCount,
  currentRound,
  roundSentAt,
  onGuestCountChange,
  onUpdateQuantity,
  onEditModifiers,
  onConfirmOrder,
  onRemoveItem,
  onSendToKitchen,
  onPayment,
  onCancelOrder,
  onConfirmRound,
  onCancelRound,
  onPrintBill,
  isShiftOpen,
  assignedCustomer,
  onAssignCustomer,
  onClearCustomer,
  topLevelCategories,
  subCategories,
  selectedCategoryId,
  selectedSubCategoryId,
  onSelectCategory,
  onSelectSubCategory,
  searchQuery,
  onSearchQueryChange,
  menuItemsList,
  allItemsForGrid,
  categoryById,
  quantitiesByMenuItemId,
  onMenuItemPress,
  onMenuItemDecrement,
}: OrderScreenSharedProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');

  // Animation values for slide+fade on category/subcategory change
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Scale animations for sticky tab switcher press feedback
  const menuTabScale = useRef(new Animated.Value(1)).current;
  const cartTabScale = useRef(new Animated.Value(1)).current;

  // Track previous selection to determine slide direction
  const prevSelectionRef = useRef<{ catId: number | null; subId: number | null }>({
    catId: selectedCategoryId,
    subId: selectedSubCategoryId,
  });

  const itemCount = useMemo(
    () =>
      itemsForPanel.filter((i) => !i.is_voided).length + pendingRoundItemsDisplay.length,
    [itemsForPanel, pendingRoundItemsDisplay],
  );

  // Auto-switch back to Menu when the cart becomes empty
  useEffect(() => {
    if (itemCount === 0) setActiveTab('menu');
  }, [itemCount]);

  // Flat list of subcategory ids for the selected category: [null=All, sub1, sub2, ...]
  const subIdList = useMemo<(number | null)[]>(
    () => [null, ...subCategories.map((s) => toInt(s.id))],
    [subCategories],
  );

  // Whether there is a previous/next category or subcategory to navigate to
  const canGoPrev = useMemo(() => {
    const currentSubIndex = subIdList.indexOf(selectedSubCategoryId);
    if (subIdList.length > 1 && currentSubIndex > 0) return true;
    const catIndex = topLevelCategories.findIndex((c) => toInt(c.id) === selectedCategoryId);
    return catIndex > 0;
  }, [subIdList, selectedSubCategoryId, topLevelCategories, selectedCategoryId]);

  const canGoNext = useMemo(() => {
    const currentSubIndex = subIdList.indexOf(selectedSubCategoryId);
    if (subIdList.length > 1 && currentSubIndex < subIdList.length - 1) return true;
    const catIndex = topLevelCategories.findIndex((c) => toInt(c.id) === selectedCategoryId);
    return catIndex < topLevelCategories.length - 1;
  }, [subIdList, selectedSubCategoryId, topLevelCategories, selectedCategoryId]);

  // Slide+fade animation when category/subcategory changes
  useEffect(() => {
    const prev = prevSelectionRef.current;
    const catIndex = topLevelCategories.findIndex((c) => toInt(c.id) === selectedCategoryId);
    const prevCatIndex = topLevelCategories.findIndex((c) => toInt(c.id) === prev.catId);
    const subIndex = subIdList.indexOf(selectedSubCategoryId);
    const prevSubIndex = subIdList.indexOf(prev.subId);

    // Determine direction: 1 = forward/next (slide in from right), -1 = back/prev (slide in from left)
    let direction = 1;
    if (catIndex !== prevCatIndex) {
      direction = catIndex > prevCatIndex ? 1 : -1;
    } else if (subIndex !== prevSubIndex) {
      direction = subIndex > prevSubIndex ? 1 : -1;
    } else {
      // No real change — skip animation
      prevSelectionRef.current = { catId: selectedCategoryId, subId: selectedSubCategoryId };
      return;
    }

    prevSelectionRef.current = { catId: selectedCategoryId, subId: selectedSubCategoryId };

    const SLIDE_DIST = 28;

    // Slide out in the direction of travel, then slide in from the opposite side
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -direction * SLIDE_DIST,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideAnim.setValue(direction * SLIDE_DIST);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, selectedSubCategoryId]);

  const navigateNext = useCallback(() => {
    const currentSubIndex = subIdList.indexOf(selectedSubCategoryId);
    if (subIdList.length > 1 && currentSubIndex < subIdList.length - 1) {
      onSelectSubCategory(subIdList[currentSubIndex + 1]);
    } else {
      const catIndex = topLevelCategories.findIndex(
        (c) => toInt(c.id) === selectedCategoryId,
      );
      if (catIndex < topLevelCategories.length - 1) {
        onSelectCategory(toInt(topLevelCategories[catIndex + 1].id));
      }
    }
  }, [subIdList, selectedSubCategoryId, topLevelCategories, selectedCategoryId, onSelectSubCategory, onSelectCategory]);

  const navigatePrev = useCallback(() => {
    const currentSubIndex = subIdList.indexOf(selectedSubCategoryId);
    if (subIdList.length > 1 && currentSubIndex > 0) {
      onSelectSubCategory(subIdList[currentSubIndex - 1]);
    } else {
      const catIndex = topLevelCategories.findIndex(
        (c) => toInt(c.id) === selectedCategoryId,
      );
      if (catIndex > 0) {
        onSelectCategory(toInt(topLevelCategories[catIndex - 1].id));
      }
    }
  }, [subIdList, selectedSubCategoryId, topLevelCategories, selectedCategoryId, onSelectSubCategory, onSelectCategory]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        // Only activate on clear horizontal sweep; let vertical scroll pass through
        .activeOffsetX([-25, 25])
        .failOffsetY([-15, 15])
        .onEnd((e) => {
          if (Math.abs(e.translationX) > 40 && Math.abs(e.velocityX) > 150) {
            if (e.translationX < 0) {
              runOnJS(navigateNext)();
            } else {
              runOnJS(navigatePrev)();
            }
          }
        }),
    [navigateNext, navigatePrev],
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Compact header */}
      <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-2">
        <Text className="flex-1 text-pos-base font-bold text-pos-text" numberOfLines={1}>
          {title}
        </Text>
        {itemCount > 0 && (
          <Text className="ml-3 text-pos-xs text-pos-text-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        )}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 'menu' ? (
          <View className="flex-1">
            <PerfProfiler id="CategoryTabs">
              <CategoryTabs
                categories={topLevelCategories}
                subCategories={subCategories}
                selectedCategoryId={selectedCategoryId}
                selectedSubCategoryId={selectedSubCategoryId}
                onSelectCategory={onSelectCategory}
                onSelectSubCategory={onSelectSubCategory}
              />
            </PerfProfiler>

            <MenuSearchBar value={searchQuery} onChangeText={onSearchQueryChange} />

            <GestureDetector gesture={swipeGesture}>
              <View className="flex-1">
                <Animated.View
                  className="flex-1"
                  style={{ transform: [{ translateX: slideAnim }], opacity: opacityAnim }}
                >
                  <PerfProfiler id="MenuGrid">
                    <MenuGrid
                      items={menuItemsList}
                      allItems={allItemsForGrid}
                      categoryById={categoryById}
                      quantitiesByMenuItemId={quantitiesByMenuItemId}
                      onItemPress={onMenuItemPress}
                      onDecrementItem={onMenuItemDecrement}
                      disabled={!isShiftOpen}
                    />
                  </PerfProfiler>
                </Animated.View>

                {/* Swipe hint arrows */}
                {canGoPrev && (
                  <Pressable
                    onPress={navigatePrev}
                    accessibilityLabel="Previous category"
                    style={{
                      position: 'absolute',
                      left: 4,
                      top: '50%',
                      marginTop: -16,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(30,30,30,0.5)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.25,
                    }}
                  >
                    <ChevronLeft size={16} color="#ffffff" />
                  </Pressable>
                )}
                {canGoNext && (
                  <Pressable
                    onPress={navigateNext}
                    accessibilityLabel="Next category"
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      marginTop: -16,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(30,30,30,0.5)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.25,
                    }}
                  >
                    <ChevronRight size={16} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            </GestureDetector>
          </View>
        ) : (
          <PerfProfiler id="OrderPanel">
            <OrderPanel
              order={order}
              items={itemsForPanel}
              guestCount={guestCount}
              onGuestCountChange={onGuestCountChange}
              onUpdateQuantity={onUpdateQuantity}
              onEditModifiers={onEditModifiers}
              onConfirmOrder={onConfirmOrder}
              onRemoveItem={onRemoveItem}
              onSendToKitchen={onSendToKitchen}
              onPayment={onPayment}
              onCancelOrder={onCancelOrder}
              pendingRoundItems={pendingRoundItemsDisplay}
              currentRound={currentRound}
              roundSentAt={roundSentAt}
              onConfirmRound={onConfirmRound}
              onCancelRound={onCancelRound}
              onPrintBill={onPrintBill}
              isShiftOpen={isShiftOpen}
              assignedCustomer={assignedCustomer}
              onAssignCustomer={onAssignCustomer}
              onClearCustomer={onClearCustomer}
            />
          </PerfProfiler>
        )}
      </View>

      {/* Sticky tab switcher */}
      <View className="flex-row border-t border-border bg-surface-card">
        <Pressable
          className={`flex-1 items-center py-3 ${activeTab === 'menu' ? 'border-b-2 border-brand' : ''}`}
          onPress={() => setActiveTab('menu')}
          onPressIn={() => Animated.timing(menuTabScale, { toValue: 0.90, duration: 80, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(menuTabScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start()}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'menu' }}
        >
          <Animated.View style={{ transform: [{ scale: menuTabScale }] }}>
            <Text
              className={`text-pos-sm font-semibold ${activeTab === 'menu' ? 'text-brand' : 'text-pos-text-muted'}`}
            >
              Menu
            </Text>
          </Animated.View>
        </Pressable>

        <Pressable
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${activeTab === 'cart' ? 'border-b-2 border-brand' : ''}`}
          onPress={() => setActiveTab('cart')}
          onPressIn={() => Animated.timing(cartTabScale, { toValue: 0.90, duration: 80, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(cartTabScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start()}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'cart' }}
        >
          <Animated.View className="flex-row items-center gap-1.5" style={{ transform: [{ scale: cartTabScale }] }}>
            <Text
              className={`text-pos-sm font-semibold ${activeTab === 'cart' ? 'text-brand' : 'text-pos-text-muted'}`}
            >
              Cart
            </Text>
            {itemCount > 0 && (
              <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1">
                <Text className="text-[10px] font-bold text-white">{itemCount}</Text>
              </View>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
