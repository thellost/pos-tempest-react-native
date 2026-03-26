import { ChevronLeft, ShoppingBag } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { ORDER_TYPE } from '@/constants/enums';
import type { Order, OrderDiscount, OrderItem, OrderItemModifier } from '@/db/models';
import { formatIDR } from '@/utils/currency';

export type OrderRow = Order & { table_number: string | null; branch_name: string | null };
export interface OrderItemRow extends OrderItem { modifiers: OrderItemModifier[] }

interface Props {
  order: OrderRow;
  items: OrderItemRow[];
  viewOnly: boolean;
  appliedDiscount: OrderDiscount | null;
  onBack: () => void;
}

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

export function OrderSummaryPanel({ order, items, viewOnly, appliedDiscount, onBack }: Props) {
  const isTakeaway = order.order_type === ORDER_TYPE.TAKEAWAY;
  const tableLabel = isTakeaway
    ? null
    : order.table_number
    ? `Table ${order.table_number}`
    : 'Order';

  const subtotal       = toNum(order.subtotal);
  const discountAmount = toNum(order.discount_amount);
  const taxAmount      = toNum(order.tax_amount);
  const serviceCharge  = toNum(order.service_charge);
  const roundingAmount = toNum(order.rounding_amount);
  const orderTotal     = toNum(order.total);
  const taxBase        = Math.max(1, subtotal - discountAmount);
  const taxRateDisplay = Math.round((taxAmount / taxBase) * 100);

  return (
    <View className="border-r border-border" style={{ width: '50%' }}>
      <View className="flex-row items-center gap-3 border-b border-border bg-surface-card px-4 py-3">
        <Button
          onPress={onBack}
          className="rounded border border-border bg-surface-raised px-2.5 py-1.5"
        >
          <View className="flex-row items-center gap-1">
            <ChevronLeft size={14} color={ThemeColors.text.muted} />
            <Text className="text-pos-sm text-pos-text-muted">Back</Text>
          </View>
        </Button>

        <View style={{ flex: 1 }}>
          {isTakeaway ? (
            <View className="flex-row items-center gap-1.5">
              <ShoppingBag size={14} color={ThemeColors.text.primary} />
              <Text className="text-pos-base font-extrabold text-pos-text">Takeaway</Text>
            </View>
          ) : (
            <Text className="text-pos-base font-extrabold text-pos-text">{tableLabel}</Text>
          )}
          <Text className="text-pos-xs text-pos-text-faint">{order.order_number}</Text>
        </View>

        <View className="rounded-full bg-accent-muted px-2.5 py-1">
          <Text className="text-[10px] font-extrabold tracking-widest text-accent">
            {viewOnly ? 'VIEW ONLY' : 'CHECKOUT'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <Text className="mt-8 text-center text-pos-sm text-pos-text-faint">No items</Text>
        ) : (
          items.map((item, index) => {
            const qty   = toNum(item.quantity);
            const price = toNum(item.unit_price);
            const total = toNum(item.total);
            return (
              <View
                key={item.id}
                className={`flex-row items-start py-2 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <View className="mr-2.5 mt-0.5 h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-muted">
                  <Text className="text-[11px] font-black text-accent-hover">
                    {qty % 1 === 0 ? qty : qty.toFixed(2)}
                  </Text>
                </View>
                <View className="mr-2 flex-1">
                  <Text className="text-pos-sm font-semibold text-pos-text" numberOfLines={1}>
                    {item.menu_item_name}
                  </Text>
                  {item.modifiers.length > 0 && (
                    <Text className="mt-0.5 text-pos-xs text-pos-text-faint">
                      {item.modifiers.map(m => m.modifier_name).join(', ')}
                    </Text>
                  )}
                  {item.notes ? (
                    <Text className="mt-0.5 text-pos-xs italic text-pos-text-faint">{item.notes}</Text>
                  ) : null}
                  <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                    {formatIDR(price)} each
                  </Text>
                </View>
                <Text className="shrink-0 text-pos-sm font-bold text-pos-text">
                  {formatIDR(total)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View className="border-t border-border bg-surface-card px-4 py-3" style={{ gap: 5 }}>
        <TotalsRow label="Subtotal" value={formatIDR(subtotal)} />
        {discountAmount > 0 && (
          <TotalsRow
            label={appliedDiscount ? `Discount (${appliedDiscount.discount_name})` : 'Discount'}
            value={`−${formatIDR(discountAmount)}`}
            valueClassName="text-pos-success"
          />
        )}
        {taxAmount > 0 && (
          <TotalsRow label={`Tax (${taxRateDisplay || 11}%)`} value={formatIDR(taxAmount)} />
        )}
        {serviceCharge > 0 && (
          <TotalsRow label="Service Charge" value={formatIDR(serviceCharge)} />
        )}
        {roundingAmount !== 0 && (
          <TotalsRow
            label="Rounding"
            value={`${roundingAmount > 0 ? '+' : ''}${formatIDR(roundingAmount)}`}
          />
        )}
        <View className="mt-1.5 flex-row items-center justify-between border-t border-border pt-2">
          <Text className="text-pos-sm font-extrabold tracking-widest text-pos-text-muted">
            TOTAL DUE
          </Text>
          <Text className="text-pos-3xl font-black text-accent">{formatIDR(orderTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

function TotalsRow({
  label,
  value,
  valueClassName = 'text-pos-text',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-pos-xs text-pos-text-faint">{label}</Text>
      <Text className={`text-pos-xs font-semibold ${valueClassName}`}>{value}</Text>
    </View>
  );
}
