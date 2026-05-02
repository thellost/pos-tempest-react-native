import type { OrderItemModifier } from '@/db/models';
import type { SelectedModifier } from '@/services/order.service';

export interface OrderItemDisplay {
  id: string;
  menu_item_id: number | string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  modifier_total: number;
  total: number;
  notes: string | null;
  is_voided: boolean;
  round_number?: number | null;
  modifiers: OrderItemModifier[];
  category_group?: string;
  weight?: number | null;
}

export interface CartItem {
  id: string;
  menu_item_id: number;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  modifier_total: number;
  total: number;
  notes: string | null;
  round_number?: number | null;
  modifiers: SelectedModifier[];
  weight: number | null;
}

export function generateLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function cartItemToDisplay(item: CartItem, categoryGroup?: string): OrderItemDisplay {
  return {
    id: item.id,
    menu_item_id: item.menu_item_id,
    menu_item_name: item.menu_item_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    modifier_total: item.modifier_total,
    total: item.total,
    notes: item.notes,
    is_voided: false,
    round_number: item.round_number,
    modifiers: item.modifiers.map(m => ({
      id: '',
      order_item_id: '',
      modifier_id: m.modifier_id,
      modifier_name: m.modifier_name,
      modifier_group_name: m.modifier_group_name,
      extra_price: m.extra_price,
    })),
    category_group: categoryGroup,
    weight: item.weight,
  };
}
