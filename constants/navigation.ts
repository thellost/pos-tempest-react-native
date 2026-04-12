import {
  Banknote,
  CalendarDays,
  ChefHat,
  ClipboardList,
  DollarSign,
  LayoutGrid,
  Package,
  Settings,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { PERMISSION } from '@/constants/permissions';
import type { Permission } from '@/constants/permissions';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  /** If set, the item is only shown when the current user has this permission. */
  permission?: Permission;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Tables & Orders', icon: LayoutGrid,   href: '/(app)/floor' },
  { label: 'Daily Orders',    icon: ClipboardList, href: '/(app)/daily-orders', permission: PERMISSION.VIEW_REPORTS },
  { label: 'Reservations',    icon: CalendarDays,  href: '/(app)/reservations', permission: PERMISSION.VIEW_RESERVATIONS },
  { label: 'Kitchen Display', icon: ChefHat,       href: '/(app)/kitchen' },
  { label: 'Inventory',       icon: Package,       href: '/(app)/inventory',    permission: PERMISSION.VIEW_INVENTORY },
  { label: 'Customers',       icon: Users,         href: '/(app)/customers' },
];

export const SYSTEM_NAV: NavItem[] = [
  { label: 'Shift',    icon: DollarSign, href: '/(app)/shifts',   permission: PERMISSION.MANAGE_SHIFT },
  { label: 'Cash',     icon: Banknote,   href: '/(app)/cash',     permission: PERMISSION.CASH_MANAGEMENT },
  { label: 'Settings', icon: Settings,   href: '/(app)/settings', permission: PERMISSION.BASIC_SETTINGS },
];
