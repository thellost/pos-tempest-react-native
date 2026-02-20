import { useQuery } from '@powersync/react';
import { useMemo } from 'react';

import type { Category, MenuItem, MenuItemModifierGroup, Modifier, ModifierGroup } from '@/db/models';
import { useAuth } from './use-auth';

/**
 * Menu item with modifiers included
 */
export interface MenuItemWithModifiers extends MenuItem {
  modifier_groups?: ModifierGroupWithModifiers[];
}

/**
 * Modifier group with its modifiers
 */
export interface ModifierGroupWithModifiers extends ModifierGroup {
  modifiers: Modifier[];
}

/**
 * Hook to manage menu data with real-time updates.
 * Queries categories with hierarchy and menu_items filtered by is_active and is_available.
 */
export function useMenu() {
  const { user } = useAuth();
  const branchId = user?.branch_id;

  // Query all active categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category>(
    `SELECT * FROM categories 
     WHERE is_active = 1 
     ORDER BY parent_id ASC, sort_order ASC`
  );

  // Query all active and available menu items
  const { data: menuItems = [], isLoading: menuItemsLoading } = useQuery<MenuItem>(
    `SELECT * FROM menu_items 
     WHERE is_active = 1 AND is_available = 1
     ORDER BY sort_order ASC`
  );

  // Query all active modifier groups
  const { data: modifierGroups = [], isLoading: modifierGroupsLoading } = useQuery<ModifierGroup>(
    `SELECT * FROM modifier_groups 
     WHERE is_active = 1 
     ORDER BY sort_order ASC`
  );

  // Query all active modifiers
  const { data: modifiers = [], isLoading: modifiersLoading } = useQuery<Modifier>(
    `SELECT * FROM modifiers 
     WHERE is_active = 1 
     ORDER BY sort_order ASC`
  );

  // Query menu item to modifier group mappings
  const { data: menuItemModifierGroups = [], isLoading: mappingsLoading } = useQuery<MenuItemModifierGroup>(
    `SELECT * FROM menu_item_modifier_groups 
     ORDER BY sort_order ASC`
  );

  // Get top-level categories (parent_id is null)
  const topLevelCategories = useMemo(() => {
    return categories.filter(cat => cat.parent_id === null || cat.parent_id === 0);
  }, [categories]);

  // Get sub-categories for a parent category
  const getSubCategories = (parentId: number): Category[] => {
    const parentIdNum = typeof parentId === 'string' ? parseInt(parentId, 10) : parentId;
    return categories.filter(cat => {
      const catParentId = typeof cat.parent_id === 'string' ? parseInt(cat.parent_id as string, 10) : cat.parent_id;
      return catParentId === parentIdNum;
    });
  };

  // Get menu items for a category
  const getMenuItemsByCategory = (categoryId: number): MenuItem[] => {
    const categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
    return menuItems.filter(item => {
      const itemCategoryId = typeof item.category_id === 'string' ? parseInt(item.category_id as string, 10) : item.category_id;
      return itemCategoryId === categoryIdNum;
    });
  };

  // Get modifier groups for a menu item
  const getModifierGroupsForMenuItem = async (menuItemId: number): Promise<ModifierGroupWithModifiers[]> => {
    try {
      const menuItemIdNum = typeof menuItemId === 'string' ? parseInt(menuItemId, 10) : menuItemId;
      
      // Get the modifier group IDs for this menu item
      const mappings = menuItemModifierGroups.filter(mapping => {
        const mappingMenuItemId = typeof mapping.menu_item_id === 'string' 
          ? parseInt(mapping.menu_item_id as string, 10) 
          : mapping.menu_item_id;
        return mappingMenuItemId === menuItemIdNum;
      });

      if (mappings.length === 0) return [];

      // Get the full modifier groups
      const groupsWithModifiers: ModifierGroupWithModifiers[] = [];

      for (const mapping of mappings) {
        const groupId = typeof mapping.modifier_group_id === 'string'
          ? parseInt(mapping.modifier_group_id as string, 10)
          : mapping.modifier_group_id;

        const group = modifierGroups.find(g => {
          const gId = typeof g.id === 'string' ? parseInt(g.id, 10) : g.id;
          return gId === groupId;
        });

        if (group) {
          // Get modifiers for this group
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

  // Search menu items by name
  const searchMenuItems = (query: string): MenuItem[] => {
    if (!query.trim()) return menuItems;
    const lowerQuery = query.toLowerCase();
    return menuItems.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery)
    );
  };

  return {
    categories,
    topLevelCategories,
    menuItems,
    modifierGroups,
    modifiers,
    getSubCategories,
    getMenuItemsByCategory,
    getModifierGroupsForMenuItem,
    searchMenuItems,
    isLoading: categoriesLoading || menuItemsLoading || modifierGroupsLoading || modifiersLoading || mappingsLoading,
  };
}
