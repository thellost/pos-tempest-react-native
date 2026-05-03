import { memo } from 'react';
import { Text, View } from 'react-native';

import { formatTime } from '@/utils/date';

interface RoundDividerProps {
  roundNumber: number;
  sentAt?: string | null;
}

/**
 * Visual divider component to separate order item rounds.
 * Shows round number and optional timestamp when sent to kitchen.
 */
function RoundDividerComponent({ roundNumber, sentAt }: RoundDividerProps) {
  return (
    <View className="my-2 flex-row items-center">
      <View className="h-px flex-1 bg-border" />
      <View className="mx-3 items-center">
        <Text className="text-pos-xs font-semibold text-pos-text-muted">
          Ronde {roundNumber}
        </Text>
        {sentAt && (
          <Text className="text-pos-xs text-pos-text-faint">
            Dikirim {formatTime(sentAt)}
          </Text>
        )}
      </View>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

export const RoundDivider = memo(RoundDividerComponent);
