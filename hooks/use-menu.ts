import { useQuery } from '@powersync/react';
import { useMemo } from 'react';

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
    `SELECT * FROM categories 
     WHERE is_active = 1 
     ORDER BY parent_id ASC, sort_order ASC`
  );

  const { data: menuItems = [], isLoading: menuItemsLoading } = useQuery<MenuItem>(
    `SELECT * FROM menu_items 
     WHERE is_active = 1
     ORDER BY sort_order ASC`
  );

  const { data: modifierGroups = [], isLoading: modifierGroupsLoading } = useQuery<ModifierGroup>(
    `SELECT * FROM modifier_groups 
     WHERE is_active = 1 
     ORDER BY sort_order ASC`
  );

  const { data: modifiers = [], isLoading: modifiersLoading } = useQuery<Modifier>(
    `SELECT * FROM modifiers 
     WHERE is_active = 1 
     ORDER BY sort_order ASC`
  );

  const { data: menuItemModifierGroups = [], isLoading: mappingsLoading } = useQuery<MenuItemModifierGroup>(
    `SELECT * FROM menu_item_modifier_groups 
     ORDER BY sort_order ASC`
  );

  const { data: inventoryData = [], isLoading: inventoryLoading } = useQuery<MenuItemInventoryInfo & { menu_item_id: number }>(
    `SELECT menu_item_id, stock_quantity, low_stock_threshold 
     FROM inventories 
     WHERE branch_id = ?`,
    [branchId ?? 0]
  );

  const inventoryMap = useMemo(() => {
    const map = new Map<number, MenuItemInventoryInfo>();
    for (const inv of inventoryData) {
      map.set(inv.menu_item_id, { stock_quantity: inv.stock_quantity, low_stock_threshold: inv.low_stock_threshold });
    }
    return map;
  }, [inventoryData]);

  const topLevelCategories = useMemo(() => {
    return categories.filter(cat => cat.parent_id === null || cat.parent_id === 0);
  }, [categories]);

  const getSubCategories = useMemo(() => {
    return (parentId: number): Category[] => {
      const parentIdNum = typeof parentId === 'string' ? parseInt(parentId as string, 10) : parentId;
      return categories.filter(cat => {
        const catParentId = typeof cat.parent_id === 'string' ? parseInt(cat.parent_id as string, 10) : cat.parent_id;
        return catParentId === parentIdNum;
      });
    };
  }, [categories]);

  const getMenuItemsByCategory = useMemo(() => {
    return (categoryId: number): MenuItemWithInventory[] => {
      const categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId as string, 10) : categoryId;
      return menuItems
        .filter(item => {
          const itemCategoryId = typeof item.category_id === 'string' ? parseInt(item.category_id as string, 10) : item.category_id;
          return itemCategoryId === categoryIdNum && item.is_available;
        })
        .map(item => {
          const inv = inventoryMap.get(typeof item.id === 'string' ? parseInt(item.id as string, 10) : item.id);
          const isLowStock = inv && inv.low_stock_threshold !== null ? inv.stock_quantity <= inv.low_stock_threshold : false;
          return { ...item, inventoryInfo: inv, isLowStock };
        });
    };
  }, [menuItems, inventoryMap]);

  const getCategoryById = useMemo(() => {
    return (categoryId: number): Category | undefined => {
      const id = typeof categoryId === 'string' ? parseInt(categoryId as string, 10) : categoryId;
      return categories.find(cat => {
        const catId = typeof cat.id === 'string' ? parseInt(cat.id as string, 10) : cat.id;
        return catId === id;
      });
    };
  }, [categories]);

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
        return menuItems.map(item => {
          const inv = inventoryMap.get(typeof item.id === 'string' ? parseInt(item.id as string, 10) : item.id);
          const isLowStock = inv && inv.low_stock_threshold !== null ? inv.stock_quantity <= inv.low_stock_threshold : false;
          return { ...item, inventory: inv, isLowStock };
        });
      }
      const lowerQuery = query.toLowerCase();
      return menuItems
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
  }, [menuItems, inventoryMap]);

  return {
    categories,
    topLevelCategories,
    menuItems,
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
