import { Button } from '@/components/ui';
import { Modal, ScrollView, Text, View } from 'react-native';

import type { BillData } from '@/services/receipt.service';
import { formatIDR } from '@/utils/currency';
import { formatReceiptDate } from '@/utils/date';

interface ReceiptPreviewProps {
  bill: BillData | null;
  onDismiss: () => void;
}

const SEP_HEAVY = '═══════════════════════════';
const SEP_LIGHT  = '───────────────────────────';

function formatDateTime(isoString: string): string {
  try {
    return formatReceiptDate(isoString);
  } catch {
    return isoString;
  }
}

function Row({ label, value, bold = false, accent = false }: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
      <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#78716C' }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: 'monospace',
        fontSize: bold ? 13 : 11,
        fontWeight: bold ? '900' : '600',
        color: accent ? '#B45309' : '#1C1917',
      }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Thermal-paper style bill / receipt preview modal.
 * Shown when "Print Bill" is tapped (no physical printer connected yet).
 */
export function ReceiptPreview({ bill, onDismiss }: ReceiptPreviewProps) {
  if (!bill) return null;

  const isReceipt = bill.payments.length > 0;

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
          style={{ maxHeight: '90%', maxWidth: '95%' }}
        >
          {/* ── Modal header ── */}
          <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-5 py-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">{isReceipt ? '🧾' : '📄'}</Text>
              <Text className="text-pos-base font-bold text-pos-text">
                {isReceipt ? 'Receipt' : 'Bill Preview'}
              </Text>
            </View>
            <Button
              onPress={onDismiss}
              className="rounded-lg bg-surface-raised px-4 py-1.5"
            >
              <Text className="text-pos-sm font-semibold text-pos-text-muted">Dismiss</Text>
            </Button>
          </View>

          {/* ── Thermal paper body ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20 }}
            style={{ backgroundColor: '#FFFBEB' }}
          >
            {/* Branch header */}
            <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1 }}>
              {SEP_HEAVY}
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: '900', textAlign: 'center', color: '#1C1917', letterSpacing: 2, marginVertical: 2 }}>
              {bill.branchName.toUpperCase()}
            </Text>
            {bill.branchAddress ? (
              <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C' }}>
                {bill.branchAddress}
              </Text>
            ) : null}
            {bill.branchPhone ? (
              <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', marginBottom: 2 }}>
                {bill.branchPhone}
              </Text>
            ) : null}
            <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1, marginBottom: 8 }}>
              {SEP_HEAVY}
            </Text>

            {/* Order info */}
            {((): [string, string][] => [
              ['Order', bill.orderNumber],
              ['Table', bill.tableLabel],
              ['Staff', bill.cashierName],
              ...(bill.customerName ? [['Guest', bill.customerName] as [string, string]] : []),
              ['Time',  formatDateTime(bill.printedAt)],
            ])().map(([label, value]) => (
              <Row key={label} label={`${label}:`} value={value} />
            ))}
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#A8A29E', marginVertical: 8 }}>
              {SEP_LIGHT}
            </Text>

            {/* Items */}
            {bill.items.map((item, index) => (
              <View
                key={index}
                style={{
                  marginBottom: 8,
                  paddingTop: index > 0 ? 6 : 0,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: '#E7E5E4',
                  borderStyle: 'dashed',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: '#1C1917', flex: 1 }}>
                    {item.quantity}x {item.name}
                  </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: '#1C1917' }}>
                    {formatIDR(item.total)}
                  </Text>
                </View>
                {item.weight != null && (
                  <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#57534E', marginLeft: 14 }}>
                    {formatIDR(Math.round(item.unitPrice / item.weight))}/{item.unitOfMeasure} × {item.weight.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {item.unitOfMeasure}
                  </Text>
                )}
                {item.modifiers.map((mod, i) => (
                  <Text key={i} style={{ fontFamily: 'monospace', fontSize: 10, color: '#57534E', marginLeft: 14 }}>
                    • {mod}
                  </Text>
                ))}
                {item.notes ? (
                  <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#B45309', marginLeft: 14, fontStyle: 'italic' }}>
                    ※ {item.notes}
                  </Text>
                ) : null}
              </View>
            ))}

            {/* Totals */}
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#A8A29E', marginVertical: 6 }}>
              {SEP_LIGHT}
            </Text>
            <Row label="Subtotal" value={formatIDR(bill.subtotal)} />
            {bill.discountAmount > 0 && (
              <Row label={`Diskon${bill.discountName ? ` (${bill.discountName})` : ''}`} value={`-${formatIDR(bill.discountAmount)}`} />
            )}
            {bill.taxAmount > 0 && (
              <Row label={`Pajak (${bill.taxRate}%)`} value={formatIDR(bill.taxAmount)} />
            )}
            {bill.serviceCharge > 0 && (
              <Row label={`Servis${bill.serviceChargeRate ? ` (${bill.serviceChargeRate}%)` : ''}`} value={formatIDR(bill.serviceCharge)} />
            )}
            {bill.roundingAmount !== 0 && (
              <Row label="Pembulatan" value={formatIDR(bill.roundingAmount)} />
            )}
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#78716C', letterSpacing: 1, marginVertical: 4 }}>
              {SEP_HEAVY}
            </Text>
            <Row label="TOTAL" value={formatIDR(bill.total)} bold accent />
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#78716C', letterSpacing: 1, marginBottom: 8 }}>
              {SEP_HEAVY}
            </Text>

            {/* Payments (receipt only) */}
            {isReceipt && (
              <>
                <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#A8A29E', marginBottom: 6 }}>
                  {SEP_LIGHT}
                </Text>
                {bill.payments.map((p, i) => (
                  <View key={i}>
                    <Row label={`Bayar (${p.method})`} value={formatIDR(p.amount)} />
                    {p.changeAmount > 0 && (
                      <Row label="Kembalian" value={formatIDR(p.changeAmount)} />
                    )}
                  </View>
                ))}
                <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#A8A29E', marginVertical: 6 }}>
                  {SEP_LIGHT}
                </Text>
              </>
            )}

            {/* Status */}
            <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1, marginVertical: 4 }}>
              {SEP_HEAVY}
            </Text>
            <Text style={{
              fontFamily: 'monospace',
              fontSize: 16,
              fontWeight: '900',
              textAlign: 'center',
              color: isReceipt ? '#15803D' : '#B45309',
              marginVertical: 4,
            }}>
              {isReceipt ? 'LUNAS' : 'BELUM BAYAR'}
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1, marginBottom: 8 }}>
              {SEP_HEAVY}
            </Text>

            {/* Footer */}
            <Text style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center', color: '#78716C', marginTop: 4 }}>
              Terima kasih! 🙏
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#A8A29E', marginTop: 2 }}>
              Sampai jumpa kembali
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#78716C', letterSpacing: 1, marginTop: 8 }}>
              {SEP_HEAVY}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
