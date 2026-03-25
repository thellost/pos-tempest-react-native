import { useCallback, useRef } from 'react';
import { TextInput, View } from 'react-native';
import { ThemeColors } from '@/constants/theme';
import { IconButton } from '@/components/ui';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface MenuSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function MenuSearchBar({
  value,
  onChangeText,
  placeholder = 'Search menu items...',
  className,
}: MenuSearchBarProps) {
  const inputRef = useRef<TextInput>(null);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  return (
    <View className={`flex-row items-center rounded-sm bg-surface-elevated px-3 py-2 mx-4 my-2 ${className ?? ''}`}>
      <MaterialIcons name="search" size={18} color={ThemeColors.text.faint} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ThemeColors.text.faint}
        className="flex-1 text-pos-base text-pos-text"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <IconButton size="sm" onPress={handleClear} hitSlop={8} className="bg-transparent">
          <MaterialIcons name="cancel" size={18} color={ThemeColors.text.faint} />
        </IconButton>
      )}
    </View>
  );
}
