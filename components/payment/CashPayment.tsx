import { memo, useCallback } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { ThemeColors } from '@/constants/theme';

import { formatIDR } from '@/utils/currency';


const QUICK_AMOUNTS_ROW1 = [1_000, 2_000, 5_000, 10_000, 20_000] as const;
const QUICK_AMOUNTS_ROW2 = [50_000, 100_000, 200_000, 500_000] as const;
const NUMPAD_ROWS = [['7','8','9'], ['4','5','6'], ['1','2','3'], ['.','0','⌫']] as const;

interface CashPaymentProps {
  value: string;
  onChange: (value: string) => void;
  remainingBalance: number;
  onExact: () => void;
}

export const CashPayment = memo(function CashPayment({
  value,
  onChange,
  remainingBalance,
  onExact,
}: CashPaymentProps) {
  const numericValue = value ? parseFloat(value) : 0;
  const change = Math.max(0, numericValue - remainingBalance);

  const handleKey = useCallback(
    (key: string) => {
      if (key === '⌫') { onChange(value.slice(0, -1)); return; }
      if (key === '.' && value.includes('.')) return;
      if (value === '0' && key !== '.') { onChange(key); return; }
      if (value.length >= 12) return;
      onChange(value + key);
    },
    [value, onChange],
  );

  const handleQuickAmount = useCallback(
    (amount: number) => onChange((numericValue + amount).toString()),
    [numericValue, onChange],
  );

  return (
    <View>
      {/* Amount display */}
      <View className="mb-2.5 min-h-[60px] justify-center rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 items-end">
        <Text
          className="w-full text-right text-pos-text"
          style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {numericValue > 0 ? formatIDR(numericValue) : '0'}
        </Text>
        {change > 0 && (
          <Text className="mt-0.5 text-xs font-semibold text-pos-success">
            Change: {formatIDR(change)}
          </Text>
        )}
      </View>

      {/* Quick amounts row 1 */}
      <View className="mb-1.5 flex-row gap-1.5">
        {QUICK_AMOUNTS_ROW1.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => handleQuickAmount(amount)}
            className="flex-1 items-center rounded border border-accent/30 bg-accent/10 py-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[11px] font-bold text-accent-hover">
              {amount >= 1000 ? `${amount / 1000}k` : String(amount)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quick amounts row 2 + Exact */}
      <View className="mb-2 flex-row gap-1.5">
        {QUICK_AMOUNTS_ROW2.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => handleQuickAmount(amount)}
            className="flex-1 items-center rounded border border-accent/30 bg-accent/10 py-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[11px] font-bold text-accent-hover">
              {amount >= 1000 ? `${amount / 1000}k` : String(amount)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onExact}
          className="flex-1 items-center rounded border border-pos-success/30 bg-pos-success/10 py-1.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-[11px] font-bold text-pos-success">Exact</Text>
        </Pressable>
      </View>

      {/* Numpad — calculator layout (7,8,9 top → 1,2,3 bottom) */}
      {NUMPAD_ROWS.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-1.5 mb-1.5">
          {row.map((key) => {
            const isBackspace = key === '⌫';
            return (
              <Pressable
                key={key}
                onPress={() => handleKey(key)}
                className={`h-12 flex-1 items-center justify-center rounded-lg border ${
                  isBackspace
                    ? 'border-pos-danger/25 bg-pos-danger-muted'
                    : 'border-border bg-surface-raised'
                }`}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                {isBackspace
                  ? <Delete size={20} color={ThemeColors.danger.DEFAULT} />
                  : <Text className="font-semibold text-pos-text" style={{ fontSize: 18 }}>{key}</Text>
                }
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});
