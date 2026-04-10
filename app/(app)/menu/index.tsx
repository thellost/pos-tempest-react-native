import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Edit2, Layers, Plus, Tag, Trash2 } from 'lucide-react-native';

import { PermissionGate } from '@/components/ui/PermissionGate';
import { PERMISSION } from '@/constants/permissions';
import { ThemeColors } from '@/constants/theme';
import { useMenu } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';

type MenuTab = 'categories' | 'items';

const TABS: { key: MenuTab; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'items', label: 'Items' },
];

function handleNotImplemented(action: string) {
  Alert.alert('Not implemented', `${action} is not yet available on this device.`);
}

export default function MenuScreen() {
  const [activeTab, setActiveTab] = useState<MenuTab>('categories');
  const { topLevelCategories, categories, menuItems, isLoading } = useMenu();

  return (
    <View className="flex-1 bg-surface">
      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <View className="flex-row border-b border-border bg-surface-card">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const color = isActive ? ThemeColors.accent.primary : ThemeColors.text.muted;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 flex-row items-center justify-center gap-2 py-3"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: isActive ? ThemeColors.accent.primary : 'transparent',
              }}
            >
              {tab.key === 'categories'
                ? <Layers size={16} color={color} />
                : <Tag size={16} color={color} />
              }
              <Text className="text-pos-sm font-bold" style={{ color }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          isLoading={isLoading}
        />
      )}
      {activeTab === 'items' && (
        <ItemsTab
          menuItems={menuItems}
          isLoading={isLoading}
        />
      )}
    </View>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

interface CategoriesTabProps {
  categories: ReturnType<typeof useMenu>['categories'];
  isLoading: boolean;
}

function CategoriesTab({ categories, isLoading }: CategoriesTabProps) {
  return (
    <View className="flex-1">
      {/* Add Category button — gated */}
      <PermissionGate permission={PERMISSION.EDIT_MENU}>
        <View className="border-b border-border bg-surface-soft px-4 py-2">
          <Pressable
            onPress={() => handleNotImplemented('Add category')}
            className="flex-row items-center gap-2 self-start rounded-sm bg-brand px-4 py-2 active:opacity-70"
          >
            <Plus size={16} color="#fff" />
            <Text className="text-pos-sm font-semibold text-white">Add Category</Text>
          </Pressable>
        </View>
      </PermissionGate>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {isLoading && (
          <Text className="text-pos-sm text-pos-text-muted">Loading categories…</Text>
        )}
        {!isLoading && categories.length === 0 && (
          <Text className="text-pos-sm text-pos-text-muted">No categories found.</Text>
        )}
        {categories.map((category) => (
          <View
            key={category.id}
            className="mb-2 flex-row items-center rounded-sm border border-border bg-surface-card px-4 py-3"
          >
            {/* Color swatch */}
            <View
              className="mr-3 h-5 w-5 rounded-full"
              style={{ backgroundColor: category.button_color ?? ThemeColors.text.muted }}
            />

            <View className="flex-1">
              <Text className="text-pos-base font-semibold text-pos-text">{category.name}</Text>
              {category.parent_id != null && (
                <Text className="text-pos-xs text-pos-text-muted">Sub-category</Text>
              )}
            </View>

            {/* Edit / Delete — gated */}
            <PermissionGate permission={PERMISSION.EDIT_MENU}>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => handleNotImplemented(`Edit "${category.name}"`)}
                  className="rounded-sm border border-border bg-surface-raised p-2 active:opacity-70"
                >
                  <Edit2 size={14} color={ThemeColors.text.muted} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Delete Category',
                      `Delete "${category.name}"? This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => handleNotImplemented(`Delete "${category.name}"`),
                        },
                      ]
                    )
                  }
                  className="rounded-sm border border-border bg-surface-raised p-2 active:opacity-70"
                >
                  <Trash2 size={14} color={ThemeColors.danger.DEFAULT} />
                </Pressable>
              </View>
            </PermissionGate>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Items Tab ────────────────────────────────────────────────────────────────

interface ItemsTabProps {
  menuItems: ReturnType<typeof useMenu>['menuItems'];
  isLoading: boolean;
}

function ItemsTab({ menuItems, isLoading }: ItemsTabProps) {
  return (
    <View className="flex-1">
      {/* Add Item button — gated */}
      <PermissionGate permission={PERMISSION.EDIT_MENU}>
        <View className="border-b border-border bg-surface-soft px-4 py-2">
          <Pressable
            onPress={() => handleNotImplemented('Add menu item')}
            className="flex-row items-center gap-2 self-start rounded-sm bg-brand px-4 py-2 active:opacity-70"
          >
            <Plus size={16} color="#fff" />
            <Text className="text-pos-sm font-semibold text-white">Add Item</Text>
          </Pressable>
        </View>
      </PermissionGate>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {isLoading && (
          <Text className="text-pos-sm text-pos-text-muted">Loading items…</Text>
        )}
        {!isLoading && menuItems.length === 0 && (
          <Text className="text-pos-sm text-pos-text-muted">No menu items found.</Text>
        )}
        {menuItems.map((item) => (
          <View
            key={item.id}
            className="mb-2 flex-row items-center rounded-sm border border-border bg-surface-card px-4 py-3"
          >
            <View className="flex-1">
              <Text className="text-pos-base font-semibold text-pos-text">{item.name}</Text>
              <Text className="text-pos-xs text-pos-text-muted">
                {formatIDR(item.price)}
                {item.pricing_type === 'weight_based' ? `/${item.unit_of_measure}` : ''}
              </Text>
            </View>

            {/* Availability badge */}
            <View
              className="mr-3 rounded-full px-2 py-0.5"
              style={{
                backgroundColor: item.is_available
                  ? ThemeColors.success.muted
                  : ThemeColors.danger.muted,
              }}
            >
              <Text
                className="text-[10px] font-bold"
                style={{
                  color: item.is_available ? ThemeColors.success.DEFAULT : ThemeColors.danger.DEFAULT,
                }}
              >
                {item.is_available ? 'AVAILABLE' : 'SOLD OUT'}
              </Text>
            </View>

            {/* Edit / Delete — gated */}
            <PermissionGate permission={PERMISSION.EDIT_MENU}>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => handleNotImplemented(`Edit "${item.name}"`)}
                  className="rounded-sm border border-border bg-surface-raised p-2 active:opacity-70"
                >
                  <Edit2 size={14} color={ThemeColors.text.muted} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Delete Item',
                      `Delete "${item.name}"? This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => handleNotImplemented(`Delete "${item.name}"`),
                        },
                      ]
                    )
                  }
                  className="rounded-sm border border-border bg-surface-raised p-2 active:opacity-70"
                >
                  <Trash2 size={14} color={ThemeColors.danger.DEFAULT} />
                </Pressable>
              </View>
            </PermissionGate>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
