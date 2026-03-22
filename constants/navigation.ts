import {
  BarChart2,
  Banknote,
  CalendarDays,
  ChefHat,
  DollarSign,
  LayoutGrid,
  Package,
  Settings,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles?: string[];
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Tables & Orders', icon: LayoutGrid,   href: '/(app)/floor' },
  { label: 'Reservations',    icon: CalendarDays,  href: '/(app)/reservations' },
  { label: 'Kitchen Display', icon: ChefHat,       href: '/(app)/kitchen' },
  { label: 'Inventory',       icon: Package,       href: '/(app)/inventory' },
  { label: 'Customers',       icon: Users,         href: '/(app)/customers' },
  { label: 'Reports',         icon: BarChart2,     href: '/(app)/reports', roles: ['admin', 'manager'] },
];

export const SYSTEM_NAV: NavItem[] = [
  { label: 'Shift',    icon: DollarSign, href: '/(app)/shifts' },
  { label: 'Cash',     icon: Banknote,   href: '/(app)/cash' },
  { label: 'Settings', icon: Settings,   href: '/(app)/settings' },
];
