import { Modal, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui';

import { ORDER_TYPE } from '@/constants/enums';
import type { KOTWithItems } from '@/services/kitchen.service';

interface KOTTicketPreviewProps {
  kot: KOTWithItems | null;
  onDismiss: () => void;
}

function formatQty(qty: number): string {
  return qty % 1 === 0 ? `${qty.toFixed(0)}x` : `${qty.toFixed(2)}x`;
}

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

const SEP_HEAVY = '═══════════════════════════';
const SEP_LIGHT = '───────────────────────────';

/**
 * Thermal-paper style KOT preview modal.
 * Shown after "Send to Kitchen" instead of printing (no printer available yet).
 */
export function KOTTicketPreview({ kot, onDismiss }: KOTTicketPreviewProps) {
  if (!kot) return null;

  const isTakeaway = kot.order_type === ORDER_TYPE.TAKEAWAY;
  const tableLabel = isTakeaway
    ? 'Takeaway 🛍️'
    : kot.table_number
      ? `Table ${kot.table_number}`
      : 'N/A';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
      >
        <View
          className="w-[380px] overflow-hidden rounded-2xl"
          style={{ maxHeight: '85%' }}
        >
          {/* ── Modal header ── */}
          <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-5 py-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">🎫</Text>
              <Text className="text-pos-base font-bold text-pos-text">
                Kitchen Ticket Sent
              </Text>
            </View>
            <Button
              onPress={onDismiss}
              className="rounded-lg bg-surface-raised px-4 py-1.5"
            >
              <Text className="text-pos-sm font-semibold text-pos-text-muted">
                Dismiss
              </Text>
            </Button>
          </View>

          {/* ── Thermal paper body ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20 }}
            style={{ backgroundColor: '#FFFBEB' }}
          >
            {/* Header */}
            <Text
              style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1 }}
            >
              {SEP_HEAVY}
            </Text>
            <Text
              style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: '900', textAlign: 'center', color: '#1C1917', letterSpacing: 3, marginVertical: 2 }}
            >
              KITCHEN ORDER
            </Text>
            <Text
              style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1, marginBottom: 10 }}
            >
              {SEP_HEAVY}
            </Text>

            {/* Ticket info rows */}
            {[
              ['KOT',   kot.ticket_number],
              ['Order', kot.order_number],
              ['Round', `Round ${kot.round_number}`],
              ['Table', tableLabel],
              ['Time',  formatDateTime(kot.created_at)],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: '#78716C' }}>
                  {label}:
                </Text>
                <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: label === 'Round' ? '#B45309' : '#1C1917' }}>
                  {value}
                </Text>
              </View>
            ))}

            <Text
              style={{ fontFamily: 'monospace', fontSize: 10, color: '#A8A29E', marginVertical: 8 }}
            >
              {SEP_LIGHT}
            </Text>

            {/* Items */}
            {kot.items.map((item, index) => (
              <View
                key={item.id}
                style={{
                  marginBottom: 8,
                  paddingTop: index > 0 ? 8 : 0,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: '#E7E5E4',
                  borderStyle: 'dashed',
                }}
              >
                <Text
                  style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: '800', color: '#1C1917' }}
                >
                  {formatQty(item.quantity)} {item.menu_item_name}
                </Text>
                {item.modifier_names.map((mod, i) => (
                  <Text
                    key={i}
                    style={{ fontFamily: 'monospace', fontSize: 11, color: '#57534E', marginLeft: 16 }}
                  >
                    • {mod}
                  </Text>
                ))}
                {item.notes ? (
                  <Text
                    style={{ fontFamily: 'monospace', fontSize: 11, color: '#B45309', marginLeft: 16, fontStyle: 'italic' }}
                  >
                    ※ {item.notes}
                  </Text>
                ) : null}
              </View>
            ))}

            <Text
              style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1, marginTop: 6 }}
            >
              {SEP_HEAVY}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
