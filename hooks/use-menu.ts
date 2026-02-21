import { useQuery } from '@powersync/react';
import { useEffect, useMemo } from 'react';

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
}

export function useMenu() {
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

  const { data: inventoryData = [], isLoading: inventoryLoading } = useQuery<MenuItemInventoryInfo & { menu_item_id: number }>(
    `SELECT menu_item_id, stock_quantity, low_stock_threshold FROM inventories WHERE branch_id = ?`,
    [branchId ?? 0]
  );

  // Filter active items
  const activeMenuItems = useMemo(() => {
    return menuItems.filter(item => Boolean(item.is_active));
  }, [menuItems]);

  const activeCategories = useMemo(() => {
    return categories.filter(cat => Boolean(cat.is_active));
  }, [categories]);

  // Debug logging (only in development)
  useEffect(() => {
    if (__DEV__ && menuItems.length > 0) {
      console.log('[useMenu] Loaded:', {
        categories: activeCategories.length,
        menuItems: activeMenuItems.length,
      });
    }
  }, [activeCategories, activeMenuItems]);

  const inventoryMap = useMemo(() => {
    const map = new Map<number, MenuItemInventoryInfo>();
    for (const inv of inventoryData) {
      map.set(inv.menu_item_id, { stock_quantity: inv.stock_quantity, low_stock_threshold: inv.low_stock_threshold });
    }
    return map;
  }, [inventoryData]);

  const topLevelCategories = useMemo(() => {
    return activeCategories.filter(cat => {
      const parentId = cat.parent_id;
      if (typeof parentId === 'string') {
        return parentId === 'null' || parentId === '' || parentId === '0';
      }
      return parentId === null || parentId === 0;
    });
  }, [activeCategories]);

  const getSubCategories = useMemo(() => {
    return (parentId: number): Category[] => {
      const parentIdNum = typeof parentId === 'string' ? parseInt(parentId as string, 10) : parentId;
      return activeCategories.filter(cat => {
        const catParentId = typeof cat.parent_id === 'string' ? parseInt(cat.parent_id as string, 10) : cat.parent_id;
        return catParentId === parentIdNum;
      });
    };
  }, [activeCategories]);

  const getMenuItemsByCategory = useMemo(() => {
    return (categoryId: number): MenuItemWithInventory[] => {
      const categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId as string, 10) : categoryId;
      
      // Get all subcategory IDs for this category
      const subCategoryIds = activeCategories
        .filter(cat => {
          if (cat.parent_id === null || cat.parent_id === undefined) return false;
          const catParentId = typeof cat.parent_id === 'string' ? parseInt(cat.parent_id, 10) : cat.parent_id;
          return catParentId === categoryIdNum;
        })
        .map(cat => typeof cat.id === 'string' ? parseInt(cat.id as string, 10) : cat.id);
      
      // Include both the main category and its subcategories
      const validCategoryIds = [categoryIdNum, ...subCategoryIds];
      
      return activeMenuItems
        .filter(item => {
          if (item.category_id === null || item.category_id === undefined) return false;
          const itemCategoryId = typeof item.category_id === 'string' ? parseInt(item.category_id, 10) : item.category_id;
          return validCategoryIds.includes(itemCategoryId) && Boolean(item.is_available);
        })
        .map(item => {
          const inv = inventoryMap.get(typeof item.id === 'string' ? parseInt(item.id as string, 10) : item.id);
          const isLowStock = inv && inv.low_stock_threshold !== null ? inv.stock_quantity <= inv.low_stock_threshold : false;
          return { ...item, inventoryInfo: inv, isLowStock };
        });
    };
  }, [activeMenuItems, activeCategories, inventoryMap]);

  const getCategoryById = useMemo(() => {
    return (categoryId: number): Category | undefined => {
      const id = typeof categoryId === 'string' ? parseInt(categoryId as string, 10) : categoryId;
      return activeCategories.find(cat => {
        const catId = typeof cat.id === 'string' ? parseInt(cat.id as string, 10) : cat.id;
        return catId === id;
      });
    };
  }, [activeCategories]);

  const getModifierGroupsForMenuItem = async (menuItemId: number): Promise<ModifierGroupWithModifiers[]> => {
    try {
      const menuItemIdNum = typeof menuItemId === 'string' ? parseInt(menuItemId as string, 10) : menuItemId;
      
      const mappings = menuItemModifierGroups.filter(mapping => {
        const mappingMenuItemId = typeof mapping.menu_item_id === 'string' 
          ? parseInt(mapping.menu_item_id as string, 10) 
          : mapping.menu_item_id;
        return mappingMenuItemId === menuItemIdNum;
      });

      if (mappings.length === 0) return [];

      const groupsWithModifiers: ModifierGroupWithModifiers[] = [];

      for (const mapping of mappings) {
        const groupId = typeof mapping.modifier_group_id === 'string'
          ? parseInt(mapping.modifier_group_id as string, 10)
          : mapping.modifier_group_id;

        const group = modifierGroups.find(g => {
          const gId = typeof g.id === 'string' ? parseInt(g.id as string, 10) : g.id;
          return gId === groupId;
        });

        if (group) {
          const groupModifiers = modifiers.filter(mod => {
            const modGroupId = typeof mod.modifier_group_id === 'string'
              ? parseInt(mod.modifier_group_id as string, 10)
              : mod.modifier_group_id;
            return modGroupId === groupId;
          });

          groupsWithModifiers.push({
            ...group,
            modifiers: groupModifiers,
          });
        }
      }

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
        return activeMenuItems.map(item => {
          const inv = inventoryMap.get(typeof item.id === 'string' ? parseInt(item.id as string, 10) : item.id);
          const isLowStock = inv && inv.low_stock_threshold !== null ? inv.stock_quantity <= inv.low_stock_threshold : false;
          return { ...item, inventoryInfo: inv, isLowStock };
        });
      }
      const lowerQuery = query.toLowerCase();
      return activeMenuItems
        .filter(item => 
          item.name.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery)
        )
        .map(item => {
          const inv = inventoryMap.get(typeof item.id === 'string' ? parseInt(item.id as string, 10) : item.id);
          const isLowStock = inv && inv.low_stock_threshold !== null ? inv.stock_quantity <= inv.low_stock_threshold : false;
          return { ...item, inventoryInfo: inv, isLowStock };
        });
    };
  }, [activeMenuItems, inventoryMap]);

  return {
    categories: activeCategories,
    topLevelCategories,
    menuItems: activeMenuItems,
    modifierGroups,
    modifiers,
    getSubCategories,
    getMenuItemsByCategory,
    getCategoryById,
    getModifierGroupsForMenuItem,
    hasModifierGroups,
    searchMenuItems,
    isLoading: categoriesLoading || menuItemsLoading || modifierGroupsLoading || modifiersLoading || mappingsLoading || inventoryLoading,
  };
}
