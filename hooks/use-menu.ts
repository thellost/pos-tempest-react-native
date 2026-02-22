import { useQuery } from '@powersync/react';
import { useEffect, useMemo, useRef } from 'react';

import type { Category, MenuItem, MenuItemModifierGroup, Modifier, ModifierGroup } from '@/db/models';
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

interface InventoryRow extends MenuItemInventoryInfo {
  menu_item_id: number;
}

interface MenuCacheState {
  categories: Category[];
  menuItems: MenuItem[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  menuItemModifierGroups: MenuItemModifierGroup[];
  inventoryData: InventoryRow[];
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
  inventoryData: [],
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
    modifierGroups: nowMs(),
    modifiers: nowMs(),
    mappings: nowMs(),
    inventory: nowMs(),
  });
  const queryLoggedRef = useRef<Record<string, boolean>>({});
  const { user } = useAuth();
  const branchId = user?.branch_id;

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category>(
    `SELECT * FROM categories ORDER BY parent_id ASC, sort_order ASC`
  );

  const { data: menuItems = [], isLoading: menuItemsLoading } = useQuery<MenuItem>(
    `SELECT * FROM menu_items ORDER BY sort_order ASC`
  );

  const { data: modifierGroups = [], isLoading: modifierGroupsLoading } = useQuery<ModifierGroup>(
    `SELECT * FROM modifier_groups WHERE is_active = 1 ORDER BY sort_order ASC`
  );

  const { data: modifiers = [], isLoading: modifiersLoading } = useQuery<Modifier>(
    `SELECT * FROM modifiers WHERE is_active = 1 ORDER BY sort_order ASC`
  );

  const { data: menuItemModifierGroups = [], isLoading: mappingsLoading } = useQuery<MenuItemModifierGroup>(
    `SELECT * FROM menu_item_modifier_groups ORDER BY sort_order ASC`
  );

  const { data: inventoryData = [], isLoading: inventoryLoading } = useQuery<InventoryRow>(
    `SELECT menu_item_id, stock_quantity, low_stock_threshold FROM inventories WHERE branch_id = ?`,
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

  useEffect(() => {
    if (!queryLoggedRef.current.modifierGroups && !modifierGroupsLoading) {
      queryLoggedRef.current.modifierGroups = true;
      logPerf('useMenu:query:modifierGroups', nowMs() - queryTimersRef.current.modifierGroups, { rows: modifierGroups.length });
    }
  }, [modifierGroups, modifierGroupsLoading]);

  useEffect(() => {
    if (!queryLoggedRef.current.modifiers && !modifiersLoading) {
      queryLoggedRef.current.modifiers = true;
      logPerf('useMenu:query:modifiers', nowMs() - queryTimersRef.current.modifiers, { rows: modifiers.length });
    }
  }, [modifiers, modifiersLoading]);

  useEffect(() => {
    if (!queryLoggedRef.current.mappings && !mappingsLoading) {
      queryLoggedRef.current.mappings = true;
      logPerf('useMenu:query:mappings', nowMs() - queryTimersRef.current.mappings, { rows: menuItemModifierGroups.length });
    }
  }, [menuItemModifierGroups, mappingsLoading]);

  useEffect(() => {
    if (!queryLoggedRef.current.inventory && !inventoryLoading) {
      queryLoggedRef.current.inventory = true;
      logPerf('useMenu:query:inventory', nowMs() - queryTimersRef.current.inventory, { rows: inventoryData.length });
    }
  }, [inventoryData, inventoryLoading]);

  const resolvedCategories = categories.length > 0 ? categories : menuCache.categories;
  const resolvedMenuItems = menuItems.length > 0 ? menuItems : menuCache.menuItems;
  const resolvedModifierGroups = modifierGroups.length > 0 ? modifierGroups : menuCache.modifierGroups;
  const resolvedModifiers = modifiers.length > 0 ? modifiers : menuCache.modifiers;
  const resolvedMappings = menuItemModifierGroups.length > 0 ? menuItemModifierGroups : menuCache.menuItemModifierGroups;
  const resolvedInventoryData = inventoryData.length > 0 ? inventoryData : menuCache.inventoryData;

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

  useEffect(() => {
    if (modifierGroups.length > 0) {
      menuCache.modifierGroups = modifierGroups;
    }
  }, [modifierGroups]);

  useEffect(() => {
    if (modifiers.length > 0) {
      menuCache.modifiers = modifiers;
    }
  }, [modifiers]);

  useEffect(() => {
    if (menuItemModifierGroups.length > 0) {
      menuCache.menuItemModifierGroups = menuItemModifierGroups;
    }
  }, [menuItemModifierGroups]);

  useEffect(() => {
    if (inventoryData.length > 0) {
      menuCache.inventoryData = inventoryData;
    }
  }, [inventoryData]);

  const activeMenuItems = useMemo(() => {
    return resolvedMenuItems.filter(item => Boolean(item.is_active));
  }, [resolvedMenuItems]);

  const activeCategories = useMemo(() => {
    return resolvedCategories.filter(cat => Boolean(cat.is_active));
  }, [resolvedCategories]);

  const inventoryMap = useMemo(() => {
    const map = new Map<number, MenuItemInventoryInfo>();
    for (const inv of resolvedInventoryData) {
      map.set(inv.menu_item_id, { stock_quantity: inv.stock_quantity, low_stock_threshold: inv.low_stock_threshold });
    }
    return map;
  }, [resolvedInventoryData]);

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
        const inventoryInfo = inventoryMap.get(itemId);
        const category = categoryId !== null ? categoryById.get(categoryId) : undefined;
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
  }, [activeMenuItems, inventoryMap, categoryById]);

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

  const modifierGroupById = useMemo(() => {
    const map = new Map<number, ModifierGroup>();
    for (const group of resolvedModifierGroups) {
      const id = toNumber(group.id);
      if (id !== null) {
        map.set(id, group);
      }
    }
    return map;
  }, [resolvedModifierGroups]);

  const modifiersByGroupId = useMemo(() => {
    const map = new Map<number, Modifier[]>();
    for (const modifier of resolvedModifiers) {
      const groupId = toNumber(modifier.modifier_group_id);
      if (groupId === null) {
        continue;
      }
      const existing = map.get(groupId) || [];
      existing.push(modifier);
      map.set(groupId, existing);
    }
    return map;
  }, [resolvedModifiers]);

  const modifierGroupIdsByMenuItemId = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const mapping of resolvedMappings) {
      const menuItemId = toNumber(mapping.menu_item_id);
      const groupId = toNumber(mapping.modifier_group_id);
      if (menuItemId === null || groupId === null) {
        continue;
      }

      const existing = map.get(menuItemId) || [];
      existing.push(groupId);
      map.set(menuItemId, existing);
    }
    return map;
  }, [resolvedMappings]);

  const getModifierGroupsForMenuItem = async (menuItemId: number): Promise<ModifierGroupWithModifiers[]> => {
    try {
      const id = toNumber(menuItemId);
      if (id === null) {
        return [];
      }

      const groupIds = modifierGroupIdsByMenuItemId.get(id) || [];
      if (groupIds.length === 0) {
        return [];
      }

      const groupsWithModifiers = groupIds
        .map((groupId) => {
          const group = modifierGroupById.get(groupId);
          if (!group) {
            return null;
          }
          return {
            ...group,
            modifiers: modifiersByGroupId.get(groupId) || [],
          };
        })
        .filter((group): group is ModifierGroupWithModifiers => group !== null);

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
      menuItemsLoading ||
      modifierGroupsLoading ||
      modifiersLoading ||
      mappingsLoading ||
      inventoryLoading,
  };
}
