import { Button } from '@/components/ui';
import { ORDER_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import type { Order, OrderDiscount, OrderItem, OrderItemModifier } from '@/db/models';
import { toFloat } from '@/utils/coerce';
import { formatIDR } from '@/utils/currency';
import { ChevronDown, ChevronLeft, ChevronUp, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export type OrderRow = Order & { table_number: string | null; branch_name: string | null; tax_rate: number; service_charge_rate: number };
export interface OrderItemRow extends OrderItem { modifiers: OrderItemModifier[] }

interface Props {
  order: OrderRow;
  items: OrderItemRow[];
  viewOnly: boolean;
  appliedDiscount: OrderDiscount | null;
  onBack: () => void;
  collapsible?: boolean;
}

export function OrderSummaryPanel({ order, items, viewOnly, appliedDiscount, onBack, collapsible = false }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isTakeaway = order.order_type === ORDER_TYPE.TAKEAWAY;
  const tableLabel = isTakeaway
    ? null
    : order.table_number
    ? `Table ${order.table_number}`
    : 'Order';

  const subtotal       = toFloat(order.subtotal);
  const discountAmount = toFloat(order.discount_amount);
  const taxAmount      = toFloat(order.tax_amount);
  const serviceCharge  = toFloat(order.service_charge);
  const roundingAmount = toFloat(order.rounding_amount);
  const orderTotal     = toFloat(order.total);
  const taxRateDisplay = order.tax_rate;
  const serviceChargeRateDisplay = order.service_charge_rate;

  const itemList = (
    <ScrollView
      style={collapsible ? { maxHeight: 280 } : { flex: 1 }}
      contentContainerStyle={{ padding: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {items.length === 0 ? (
        <Text className="mt-8 text-center text-pos-sm text-pos-text-faint">No items</Text>
      ) : (
        items.map((item, index) => {
          const qty   = toFloat(item.quantity);
          const price = toFloat(item.unit_price);
          const total = toFloat(item.total);
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
  );

  const totalsFooter = (
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
        <TotalsRow label={`Tax (${taxRateDisplay}%)`} value={formatIDR(taxAmount)} />
      )}
      {serviceCharge > 0 && (
        <TotalsRow label={`Service Charge (${serviceChargeRateDisplay}%)`} value={formatIDR(serviceCharge)} />
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
  );

  if (collapsible) {
    return (
      <View className="border-b border-border">
        <Pressable
          onPress={() => setIsCollapsed(prev => !prev)}
          className="flex-row items-center gap-3 bg-surface-card px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          {/* Back button — inner Pressable captures its own events */}
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
            <Text className="text-pos-xs text-pos-text-faint">
              {items.length} item{items.length !== 1 ? 's' : ''} · {formatIDR(orderTotal)}
            </Text>
          </View>

          {isCollapsed
            ? <ChevronDown size={18} color={ThemeColors.text.muted} />
            : <ChevronUp size={18} color={ThemeColors.text.muted} />
          }
        </Pressable>

        {!isCollapsed && (
          <>
            {itemList}
            {totalsFooter}
          </>
        )}
      </View>
    );
  }

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

      {itemList}
      {totalsFooter}
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
