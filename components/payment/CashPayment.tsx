import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatIDR } from '@/utils/currency';

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;
const QUICK_AMOUNTS_ROW1 = [1_000, 2_000, 5_000, 10_000, 20_000] as const;
const QUICK_AMOUNTS_ROW2 = [50_000, 100_000, 200_000, 500_000] as const;

interface CashPaymentProps {
  /** Current input value as a string (e.g. "100000") */
  value: string;
  onChange: (value: string) => void;
  /** The amount still owed — used to show change in real time */
  remainingBalance: number;
  /** Called when the "Exact" quick button is tapped */
  onExact: () => void;
}

/**
 * Cash amount entry panel with numpad, quick-amount buttons, and change preview.
 * Designed for a landscape tablet — compact but finger-friendly.
 */
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
      if (key === '⌫') {
        onChange(value.slice(0, -1));
        return;
      }
      // Only one decimal point allowed
      if (key === '.' && value.includes('.')) return;
      // Replace leading zero unless following a decimal
      if (value === '0' && key !== '.') {
        onChange(key);
        return;
      }
      // Limit total length to prevent overflow
      if (value.length >= 12) return;
      onChange(value + key);
    },
    [value, onChange],
  );

  const handleQuickAmount = useCallback(
    (amount: number) => {
      onChange(amount.toString());
    },
    [onChange],
  );

  return (
    <View>
      {/* Amount display */}
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.09)',
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginBottom: 10,
          alignItems: 'flex-end',
          minHeight: 60,
          justifyContent: 'center',
        }}
      >
        <Text
          style={{ fontSize: 28, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {numericValue > 0 ? formatIDR(numericValue) : 'Rp0'}
        </Text>
        {change > 0 && (
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981', marginTop: 2 }}>
            Change: {formatIDR(change)}
          </Text>
        )}
      </View>

      {/* Quick amount buttons — row 1: small denominations */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
        {QUICK_AMOUNTS_ROW1.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => handleQuickAmount(amount)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: 7,
              borderRadius: 6,
              backgroundColor: pressed
                ? 'rgba(99,102,241,0.25)'
                : 'rgba(99,102,241,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.3)',
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#818CF8' }}>
              {amount >= 1000 ? `${amount / 1000}k` : String(amount)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quick amount buttons — row 2: large denominations + Exact */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        {QUICK_AMOUNTS_ROW2.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => handleQuickAmount(amount)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: 7,
              borderRadius: 6,
              backgroundColor: pressed
                ? 'rgba(99,102,241,0.25)'
                : 'rgba(99,102,241,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.3)',
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#818CF8' }}>
              {amount >= 1000 ? `${amount / 1000}k` : String(amount)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onExact}
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            paddingVertical: 7,
            borderRadius: 6,
            backgroundColor: pressed
              ? 'rgba(16,185,129,0.25)'
              : 'rgba(16,185,129,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(16,185,129,0.3)',
          })}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Exact</Text>
        </Pressable>
      </View>

      {/* Numpad grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {NUMPAD_KEYS.map((key) => {
          const isBackspace = key === '⌫';
          return (
            <Pressable
              key={key}
              onPress={() => handleKey(key)}
              style={({ pressed }) => ({
                width: '31%',
                flexGrow: 1,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: isBackspace
                  ? 'rgba(239,68,68,0.25)'
                  : 'rgba(255,255,255,0.07)',
                backgroundColor: isBackspace
                  ? pressed
                    ? 'rgba(239,68,68,0.3)'
                    : 'rgba(239,68,68,0.1)'
                  : pressed
                  ? 'rgba(255,255,255,0.14)'
                  : 'rgba(255,255,255,0.05)',
              })}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: isBackspace ? '#EF4444' : '#F8FAFC',
                }}
              >
                {key}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
