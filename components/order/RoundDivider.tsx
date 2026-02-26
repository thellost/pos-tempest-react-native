import { Text, View } from 'react-native';

interface RoundDividerProps {
  roundNumber: number;
  sentAt?: string | null;
}

/**
 * Visual divider component to separate order item rounds.
 * Shows round number and optional timestamp when sent to kitchen.
 */
export function RoundDivider({ roundNumber, sentAt }: RoundDividerProps) {
  const formatSentTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(date);
      }
    } catch {
      // Fall through to manual formatter
    }
    // Safe 24-hour fallback for environments without Intl locale support
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <View className="my-2 flex-row items-center">
      <View className="h-px flex-1 bg-border" />
      <View className="mx-3 items-center">
        <Text className="text-pos-xs font-semibold text-pos-text-muted">
          Ronde {roundNumber}
        </Text>
        {sentAt && (
          <Text className="text-pos-xs text-pos-text-faint">
            Dikirim {formatSentTime(sentAt)}
          </Text>
        )}
      </View>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
