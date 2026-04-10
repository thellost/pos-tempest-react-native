import { Pressable, Text, TextInput, View } from 'react-native';
import { Search, Star } from 'lucide-react-native';
import { useQuery } from '@powersync/react';

import { ThemeColors } from '@/constants/theme';

export interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  loyalty_points: number;
}

interface CustomerSearchDropdownProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (customer: CustomerRow) => void;
  selectedCustomerId?: number | null;
  placeholder?: string;
}

/**
 * Customer search input with live dropdown results.
 * Searches by name or phone; shows dropdown only when typing and no customer is selected yet.
 */
export function CustomerSearchDropdown({
  value,
  onChangeText,
  onSelect,
  selectedCustomerId,
  placeholder = 'Search customer by name or phone…',
}: CustomerSearchDropdownProps) {
  const pattern = `%${value}%`;

  const { data: results } = useQuery<CustomerRow>(
    `SELECT id, name, phone, loyalty_points
     FROM customers
     WHERE (name LIKE ? OR phone LIKE ?) AND is_active = 1
     LIMIT 10`,
    [pattern, pattern],
  );

  const showDropdown = value.length > 0 && selectedCustomerId == null;

  return (
    <View className="relative">
      <View className="flex-row items-center rounded-xl border border-border bg-surface px-4 py-2.5">
        <Search size={16} color={ThemeColors.text.muted} style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={ThemeColors.text.faint}
          className="flex-1 text-pos-base text-pos-text"
        />
      </View>

      {showDropdown && results.length > 0 && (
        <View className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface-card">
          {results.map((customer) => (
            <Pressable
              key={customer.id}
              onPress={() => onSelect(customer)}
              className="flex-row items-center justify-between border-b border-border px-4 py-3 last:border-0 active:bg-surface-raised"
            >
              <View className="flex-1">
                <Text className="text-pos-sm font-semibold text-pos-text" numberOfLines={1}>
                  {customer.name}
                </Text>
                {customer.phone && (
                  <Text className="text-pos-xs text-pos-muted">{customer.phone}</Text>
                )}
              </View>
              {customer.loyalty_points > 0 && (
                <View className="ml-3 flex-row items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5">
                  <Star size={10} color={ThemeColors.accent.primary} />
                  <Text className="text-pos-xs font-semibold text-brand">
                    {customer.loyalty_points.toLocaleString('id-ID')}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
