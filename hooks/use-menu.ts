import { useQuery } from '@powersync/react';
import { useEffect, useMemo, useRef } from 'react';

import type { Category, MenuItem, MenuItemModifierGroup, Modifier, ModifierGroup } from '@/db/models';
import { powersync } from '@/db/provider';
import { useAuth } from './use-auth';

export interface MenuItemWithModifiers extends MenuItem {
  modifier_groups?: ModifierGroupWithModifiers[];
}

export interface ModifierGroupWithModifiers extends ModifierGroup {
  modifiers: Modifier[];
}

export interface MenuItemInventoryInfo {
  stock_quantity: number;
  low_stock_threshold: number | null;
}

export interface MenuItemWithInventory extends MenuItem {
  inventoryInfo?: MenuItemInventoryInfo;
  isLowStock?: boolean;
  categoryName?: string;
}

interface MenuItemWithInventoryRow extends MenuItem {
  stock_quantity: number | null;
  low_stock_threshold: number | null;
}

interface MenuCacheState {
  categories: Category[];
  menuItems: MenuItemWithInventoryRow[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  menuItemModifierGroups: MenuItemModifierGroup[];
}

interface PreparedMenuItem extends MenuItemWithInventory {
  _itemId: number;
  _categoryId: number | null;
}

const menuCache: MenuCacheState = {
  categories: [],
  menuItems: [],
  modifierGroups: [],
  modifiers: [],
  menuItemModifierGroups: [],
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function nowMs(): number {
  if (typeof globalThis.performance !== 'undefined' && typeof globalThis.performance.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function logPerf(label: string, valueMs: number, meta?: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }

  const rounded = Math.round(valueMs * 10) / 10;
  if (meta) {
    console.log(`[perf] ${label}: ${rounded}ms`, meta);
    return;
  }

  console.log(`[perf] ${label}: ${rounded}ms`);
}

export function useMenu() {
  const bootStartRef = useRef(nowMs());
  const hasLoggedMenuReadyRef = useRef(false);
  const queryTimersRef = useRef<Record<string, number>>({
    categories: nowMs(),
    menuItems: nowMs(),
  });
  const queryLoggedRef = useRef<Record<string, boolean>>({});
  const { user } = useAuth();
  const branchId = user?.branch_id;

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category>(
    `SELECT * FROM categories ORDER BY parent_id ASC, sort_order ASC`
  );

  const { data: menuItems = [], isLoading: menuItemsLoading } = useQuery<MenuItemWithInventoryRow>(
    `SELECT mi.*, inv.stock_quantity, inv.low_stock_threshold
     FROM menu_items mi
     LEFT JOIN inventories inv ON inv.menu_item_id = mi.id AND inv.branch_id = ?
     ORDER BY mi.sort_order ASC`,
    [branchId ?? 0]
  );

  // -- Log individual query resolution times --
  useEffect(() => {
    if (!queryLoggedRef.current.categories && categories.length > 0) {
      queryLoggedRef.current.categories = true;
      logPerf('useMenu:query:categories', nowMs() - queryTimersRef.current.categories, { rows: categories.length });
    }
  }, [categories]);

  useEffect(() => {
    if (!queryLoggedRef.current.menuItems && menuItems.length > 0) {
      queryLoggedRef.current.menuItems = true;
      logPerf('useMenu:query:menuItems', nowMs() - queryTimersRef.current.menuItems, { rows: menuItems.length });
    }
  }, [menuItems]);

  const resolvedCategories = categories.length > 0 ? categories : menuCache.categories;
  const resolvedMenuItems = menuItems.length > 0 ? menuItems : menuCache.menuItems;
  const resolvedModifierGroups = menuCache.modifierGroups;
  const resolvedModifiers = menuCache.modifiers;

  useEffect(() => {
    if (categories.length > 0) {
      menuCache.categories = categories;
    }
  }, [categories]);

  useEffect(() => {
    if (menuItems.length > 0) {
      menuCache.menuItems = menuItems;
    }
  }, [menuItems]);

  const activeMenuItems = useMemo(() => {
    return resolvedMenuItems.filter(item => Boolean(item.is_active));
  }, [resolvedMenuItems]);

  const activeCategories = useMemo(() => {
    return resolvedCategories.filter(cat => Boolean(cat.is_active));
  }, [resolvedCategories]);

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>();
    for (const category of activeCategories) {
      const categoryId = toNumber(category.id);
      if (categoryId !== null) {
        map.set(categoryId, category);
      }
    }
    return map;
  }, [activeCategories]);

  const subCategoriesByParentId = useMemo(() => {
    const map = new Map<number, Category[]>();
    for (const category of activeCategories) {
      const parentId = toNumber(category.parent_id);
      if (parentId === null || parentId === 0) {
        continue;
      }

      const existing = map.get(parentId) || [];
      existing.push(category);
      map.set(parentId, existing);
    }
    return map;
  }, [activeCategories]);

  const topLevelCategories = useMemo(() => {
    return activeCategories.filter((category) => {
      const parentId = toNumber(category.parent_id);
      return parentId === null || parentId === 0;
    });
  }, [activeCategories]);

  const preparedMenuItems = useMemo<PreparedMenuItem[]>(() => {
    return activeMenuItems
      .filter((item) => Boolean(item.is_available))
      .map((item) => {
        const itemId = toNumber(item.id) || 0;
        const categoryId = toNumber(item.category_id);
        const category = categoryId !== null ? categoryById.get(categoryId) : undefined;
        const inventoryInfo: MenuItemInventoryInfo | undefined =
          item.stock_quantity != null
            ? { stock_quantity: item.stock_quantity, low_stock_threshold: item.low_stock_threshold }
            : undefined;
        const isLowStock =
          inventoryInfo && inventoryInfo.low_stock_threshold !== null
            ? inventoryInfo.stock_quantity <= inventoryInfo.low_stock_threshold
            : false;

        return {
          ...item,
          inventoryInfo,
          isLowStock,
          categoryName: category?.name || 'Food & Drink',
          _itemId: itemId,
          _categoryId: categoryId,
        };
      });
  }, [activeMenuItems, categoryById]);

  const menuItemsByExactCategoryId = useMemo(() => {
    const map = new Map<number, PreparedMenuItem[]>();
    for (const item of preparedMenuItems) {
      if (item._categoryId === null) {
        continue;
      }
      const existing = map.get(item._categoryId) || [];
      existing.push(item);
      map.set(item._categoryId, existing);
    }
    return map;
  }, [preparedMenuItems]);

  const getSubCategories = useMemo(() => {
    return (parentId: number): Category[] => {
      const id = toNumber(parentId);
      if (id === null) {
        return [];
      }
      return subCategoriesByParentId.get(id) || [];
    };
  }, [subCategoriesByParentId]);

  const getMenuItemsByCategory = useMemo(() => {
    return (categoryId: number): MenuItemWithInventory[] => {
      const queryStart = nowMs();
      const id = toNumber(categoryId);
      if (id === null) {
        logPerf('menu_by_category_invalid', nowMs() - queryStart, { categoryId });
        return [];
      }

      const validCategoryIds = [id, ...(subCategoriesByParentId.get(id) || []).map((category) => toNumber(category.id) || 0)];
      const collected: PreparedMenuItem[] = [];

      for (const validId of validCategoryIds) {
        const items = menuItemsByExactCategoryId.get(validId);
        if (items && items.length > 0) {
          collected.push(...items);
        }
      }

      const elapsed = nowMs() - queryStart;
      if (__DEV__ && elapsed >= 8) {
        logPerf('menu_by_category', elapsed, {
          categoryId: id,
          categoriesScanned: validCategoryIds.length,
          itemsReturned: collected.length,
        });
      }

      return collected;
    };
  }, [menuItemsByExactCategoryId, subCategoriesByParentId]);

  const getCategoryById = useMemo(() => {
    return (categoryId: number): Category | undefined => {
      const id = toNumber(categoryId);
      if (id === null) {
        return undefined;
      }
      return categoryById.get(id);
    };
  }, [categoryById]);

  const getModifierGroupsForMenuItem = async (menuItemId: number): Promise<ModifierGroupWithModifiers[]> => {
    try {
      const queryStart = nowMs();
      const id = toNumber(menuItemId);
      if (id === null) {
        return [];
      }

      const groups = await powersync.getAll<ModifierGroup>(
        `SELECT mg.*
         FROM menu_item_modifier_groups mimg
         INNER JOIN modifier_groups mg ON mg.id = mimg.modifier_group_id
         WHERE mimg.menu_item_id = ? AND mg.is_active = 1
         ORDER BY mimg.sort_order ASC, mg.sort_order ASC`,
        [id]
      );

      if (groups.length === 0) {
        return [];
      }

      const groupIds = groups
        .map((group) => toNumber(group.id))
        .filter((groupId): groupId is number => groupId !== null);

      const placeholders = groupIds.map(() => '?').join(', ');
      const modifiers = groupIds.length > 0
        ? await powersync.getAll<Modifier>(
          `SELECT * FROM modifiers
           WHERE is_active = 1 AND modifier_group_id IN (${placeholders})
           ORDER BY sort_order ASC`,
          groupIds
        )
        : [];

      const modifiersByGroupId = new Map<number, Modifier[]>();
      for (const modifier of modifiers) {
        const groupId = toNumber(modifier.modifier_group_id);
        if (groupId === null) {
          continue;
        }
        const existing = modifiersByGroupId.get(groupId) || [];
        existing.push(modifier);
        modifiersByGroupId.set(groupId, existing);
      }

      const groupsWithModifiers = groups.map((group) => {
        const groupId = toNumber(group.id) || 0;
        return {
          ...group,
          modifiers: modifiersByGroupId.get(groupId) || [],
        };
      });

      menuCache.modifierGroups = groups;
      menuCache.modifiers = modifiers;

      logPerf('useMenu:query:modifier_groups_for_item', nowMs() - queryStart, {
        menuItemId: id,
        groups: groups.length,
        modifiers: modifiers.length,
      });

      return groupsWithModifiers;
    } catch (error) {
      console.error('[useMenu] Error getting modifier groups:', error);
      return [];
    }
  };

  const hasModifierGroups = async (menuItemId: number): Promise<boolean> => {
    const groups = await getModifierGroupsForMenuItem(menuItemId);
    return groups.length > 0;
  };

  const searchMenuItems = useMemo(() => {
    return (query: string): MenuItemWithInventory[] => {
      if (!query.trim()) {
        return preparedMenuItems;
      }

      const lowerQuery = query.toLowerCase();
      return preparedMenuItems.filter(item => 
          item.name.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery)
        );
    };
  }, [preparedMenuItems]);

  useEffect(() => {
    if (hasLoggedMenuReadyRef.current) {
      return;
    }

    if (activeCategories.length > 0 && activeMenuItems.length > 0) {
      hasLoggedMenuReadyRef.current = true;
      logPerf('menu_ready_total', nowMs() - bootStartRef.current, {
        categories: activeCategories.length,
        menuItems: activeMenuItems.length,
        fromCache: categories.length === 0 || menuItems.length === 0,
      });
    }
  }, [activeCategories.length, activeMenuItems.length, categories.length, menuItems.length]);

  return {
    categories: activeCategories,
    topLevelCategories,
    menuItems: activeMenuItems,
    modifierGroups: resolvedModifierGroups,
    modifiers: resolvedModifiers,
    getSubCategories,
    getMenuItemsByCategory,
    getCategoryById,
    getModifierGroupsForMenuItem,
    hasModifierGroups,
    searchMenuItems,
    isLoading:
      activeCategories.length === 0 &&
      activeMenuItems.length === 0 &&
      (categoriesLoading || menuItemsLoading),
    isHydrating:
      categoriesLoading ||
      menuItemsLoading,
  };
}
