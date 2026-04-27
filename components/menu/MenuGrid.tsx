import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, type LayoutChangeEvent, RefreshControl, ScrollView, Text, View } from 'react-native';
import { ClipboardList, Lock } from 'lucide-react-native';
import { ThemeColors } from '@/constants/theme';

import type { MenuItemWithInventory } from '@/hooks/use-menu';

import { MenuItemCard } from './MenuItemCard';

const GRID_PADDING = 10;
const GAP = 8;
const MIN_ITEM_WIDTH = 150;
const ASPECT_RATIO = 0.52;

function toNumberId(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

interface MenuGridProps {
  /** Visible items for the current category / search — used to toggle visibility */
  items: MenuItemWithInventory[];
  /** Every item across all categories — mounted once, hidden via display:'none' */
  allItems: MenuItemWithInventory[];
  /** Category info keyed by numeric category ID — used for per-item accent colour and label */
  categoryById?: Map<number, { name: string; button_color?: string | null }>;
  quantitiesByMenuItemId?: Record<number, number>;
  onItemPress: (item: MenuItemWithInventory) => void;
  onDecrementItem?: (item: MenuItemWithInventory) => void;
  onRefresh?: () => Promise<void>;
  /** When true, overlays the grid with a "no active shift" lock screen */
  disabled?: boolean;
}

interface MenuItemCellProps {
  item: MenuItemWithInventory;
  isVisible: boolean;
  quantity: number;
  itemWidth: number;
  itemHeight: number;
  categoryColor?: string | null;
  categoryName?: string | null;
  onItemPress: (item: MenuItemWithInventory) => void;
  onDecrementItem?: (item: MenuItemWithInventory) => void;
  marginRight?: number;
  marginBottom?: number;
}

/**
 * Memoised grid cell.
 * Hidden via `display: 'none'` which removes it from the flex-wrap layout
 * flow so visible items reflow correctly — no gaps, no manual row math.
 * Only re-renders when visibility, quantity, or item data actually changes.
 */
const MenuItemCell = memo(
  function MenuItemCell({
    item,
    isVisible,
    quantity,
    itemWidth,
    itemHeight,
    categoryColor,
    categoryName,
    onItemPress,
    onDecrementItem,
    marginRight = 0,
    marginBottom = 0,
  }: MenuItemCellProps) {
    return (
      <View
        style={[
          { width: itemWidth, height: itemHeight, marginRight, marginBottom },
          !isVisible && ({ display: 'none' } as object),
        ]}
      >
        <MenuItemCard
          item={item}
          categoryColor={categoryColor}
          categoryName={categoryName}
          quantity={quantity}
          onPressItem={onItemPress}
          onDecrementItem={onDecrementItem}
        />
      </View>
    );
  },
  (prev, next) =>
    prev.isVisible === next.isVisible &&
    prev.quantity === next.quantity &&
    prev.itemWidth === next.itemWidth &&
    prev.itemHeight === next.itemHeight &&
    prev.categoryColor === next.categoryColor &&
    prev.categoryName === next.categoryName &&
    prev.item.id === next.item.id &&
    prev.item.name === next.item.name &&
    prev.item.price === next.item.price &&
    prev.item.pricing_type === next.item.pricing_type &&
    prev.item.is_available === next.item.is_available &&
    prev.item.isLowStock === next.item.isLowStock &&
    prev.onItemPress === next.onItemPress &&
    prev.onDecrementItem === next.onDecrementItem,
);

/**
 * High-performance menu grid that mounts ALL items once and toggles
 * visibility via `display: 'none'` on category switch.
 *
 * Strategy:
 *  - Initial mount: all items rendered once, deferred via InteractionManager
 *    so the navigation animation is not blocked.
 *  - Category switch: only the `visibleIds` Set is rebuilt → each cell's
 *    memo comparator checks `isVisible`; only changed cells re-render.
 *    Cost: ~5–15 ms regardless of item count.
 *  - `display: 'none'` removes items from the flex-wrap flow so the
 *    remaining visible items reflow into correct columns automatically.
 */
export function MenuGrid({
  items,
  allItems,
  categoryById,
  quantitiesByMenuItemId,
  onItemPress,
  onDecrementItem,
  onRefresh,
  disabled = false,
}: MenuGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  }, [containerWidth]);

  const gridWidth = containerWidth - GRID_PADDING * 2;
  const columns = gridWidth > 0
    ? Math.max(1, Math.floor((gridWidth + GAP) / (MIN_ITEM_WIDTH + GAP)))
    : 2;
  const itemWidth = gridWidth > 0 ? (gridWidth - GAP * (columns - 1)) / columns : MIN_ITEM_WIDTH;
  const itemHeight = itemWidth * ASPECT_RATIO;

  // Normalised set of visible IDs — using string keys avoids string/number mismatches
  const visibleIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) s.add(String(i.id));
    return s;
  }, [items]);

  // Precompute per-item derived values once per allItems/categoryById change.
  // This keeps the render loop cheap (no parseInt / map lookups per render).
  const allCells = useMemo(() => {
    return allItems.map((item) => {
      const idKey = String(item.id);
      const idNum = toNumberId(item.id);

      const categoryIdNum = toNumberId(item.category_id);
      const category = categoryIdNum !== null ? categoryById?.get(categoryIdNum) : undefined;

      return {
        item,
        idKey,
        idNum,
        categoryColor: category?.button_color ?? null,
        categoryName: category?.name ?? null,
      };
    });
  }, [allItems, categoryById]);

  // Defer mounting all cards until after the navigation animation settles
  const [isMounted, setIsMounted] = useState(false);
  const hasMountedRef = useRef(false);

  // Keep handler identities stable so MenuItemCell memoization isn't defeated
  // by upstream components re-creating callbacks on each render.
  const onItemPressRef = useRef(onItemPress);
  const onDecrementItemRef = useRef(onDecrementItem);

  useEffect(() => {
    onItemPressRef.current = onItemPress;
  }, [onItemPress]);

  useEffect(() => {
    onDecrementItemRef.current = onDecrementItem;
  }, [onDecrementItem]);

  const handleItemPress = useCallback((item: MenuItemWithInventory) => {
    onItemPressRef.current(item);
  }, []);

  const handleDecrementItem = useCallback((item: MenuItemWithInventory) => {
    onDecrementItemRef.current?.(item);
  }, []);

  useEffect(() => {
    if (hasMountedRef.current) return;

    if (allItems.length === 0) {
      setIsMounted(true);
      hasMountedRef.current = true;
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setIsMounted(true);
      hasMountedRef.current = true;
    });

    return () => task.cancel();
  }, [allItems.length]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isMounted) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface" onLayout={handleLayout}>
      <ScrollView
        contentContainerStyle={{ padding: GRID_PADDING }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={ThemeColors.accent.primary}
              colors={[ThemeColors.accent.primary]}
            />
          ) : undefined
        }
      >
        {/* flex-wrap: display:'none' items are removed from layout flow */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {allCells.map((cell, idx) => {
            const quantity =
              cell.idNum !== null ? (quantitiesByMenuItemId?.[cell.idNum] ?? 0) : 0;
            // Calculate row/col for margin logic
            const col = idx % columns;
            const row = Math.floor(idx / columns);
            const isLastCol = col === columns - 1;
            const isLastRow = row === Math.floor((allCells.length - 1) / columns);
            const marginRight = isLastCol ? 0 : GAP;
            const marginBottom = isLastRow ? 0 : GAP;
            return (
              <MenuItemCell
                key={cell.idKey}
                item={cell.item}
                isVisible={visibleIds.has(cell.idKey)}
                quantity={quantity}
                itemWidth={itemWidth}
                itemHeight={itemHeight}
                categoryColor={cell.categoryColor}
                categoryName={cell.categoryName}
                onItemPress={handleItemPress}
                onDecrementItem={handleDecrementItem}
                marginRight={marginRight}
                marginBottom={marginBottom}
              />
            );
          })}
        </View>

        {/* Empty state — visible items filtered to zero */}
        {items.length === 0 && allItems.length > 0 && (
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
              <ClipboardList size={32} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-lg text-pos-text-muted">No items available</Text>
            <Text className="mt-2 text-pos-sm text-pos-text-faint">in this category</Text>
          </View>
        )}
      </ScrollView>

      {/* No-shift overlay — blocks item interaction when no active shift */}
      {disabled && (
        <View
          className="absolute bottom-0 left-0 right-0 top-0 z-10 items-center justify-center"
          style={{ backgroundColor: ThemeColors.surfaces.overlay }}
        >
          <View className="items-center rounded-2xl bg-surface-card px-10 py-8">
            <Lock size={36} color={ThemeColors.text.muted} style={{ marginBottom: 8 }} />
            <Text className="text-pos-lg font-bold text-pos-text">No Active Shift</Text>
            <Text className="mt-1 text-pos-sm text-pos-text-muted text-center">
              Open a shift to start taking orders
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
