export const ROLE_TYPE = {
	ADMIN: 'admin',
	MANAGER: 'manager',
	CASHIER: 'cashier',
	WAITER: 'waiter',
	/** @deprecated CHEF is no longer used for login roles. Kitchen display does not require user login. */
	CHEF: 'chef',
} as const;

export type RoleType = (typeof ROLE_TYPE)[keyof typeof ROLE_TYPE];

export const PRICING_TYPE = {
	FIXED: 'fixed',
	WEIGHT_BASED: 'weight_based',
} as const;

export type PricingType = (typeof PRICING_TYPE)[keyof typeof PRICING_TYPE];

export const UNIT_OF_MEASURE = {
	PIECE: 'piece',
	KG: 'kg',
	GRAM: 'gram',
	ONS: 'ons',
	LITER: 'liter',
	ML: 'ml',
	PORTION: 'portion',
} as const;

export type UnitOfMeasure = (typeof UNIT_OF_MEASURE)[keyof typeof UNIT_OF_MEASURE];

export const ORDER_TYPE = {
	DINE_IN: 'dine_in',
	TAKEAWAY: 'takeaway',
} as const;

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

export const ORDER_STATUS = {
	PENDING: 'pending',
	CONFIRMED: 'confirmed',
	PREPARING: 'preparing',
	READY: 'ready',
	SERVED: 'served',
	COMPLETED: 'completed',
	CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const PAYMENT_METHOD_TYPE = {
	CASH: 'cash',
	DEBIT_CARD: 'debit_card',
	CREDIT_CARD: 'credit_card',
	EWALLET: 'ewallet',
	QRIS: 'qris',
	BANK_TRANSFER: 'bank_transfer',
} as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPE)[keyof typeof PAYMENT_METHOD_TYPE];

export const PAYMENT_STATUS = {
	UNPAID: 'unpaid',
	PARTIAL: 'partial',
	PAID: 'paid',
	REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const TABLE_STATUS = {
	AVAILABLE: 'available',
	OCCUPIED: 'occupied',
	RESERVED: 'reserved',
	MAINTENANCE: 'maintenance',
} as const;

export type TableStatus = (typeof TABLE_STATUS)[keyof typeof TABLE_STATUS];

export const PURCHASE_STATUS = {
	ORDERED: 'ordered',
	PARTIAL_RECEIVED: 'partial_received',
	RECEIVED: 'received',
	CANCELLED: 'cancelled',
} as const;

export type PurchaseStatus = (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

export const SHIFT_STATUS = {
	OPEN: 'open',
	CLOSED: 'closed',
} as const;

export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS];

export const DISCOUNT_TYPE = {
	PERCENTAGE: 'percentage',
	FIXED_AMOUNT: 'fixed_amount',
} as const;

export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];

export const KOT_STATUS = {
	PENDING: 'pending',
	IN_PROGRESS: 'in_progress',
	READY: 'ready',
	SERVED: 'served',
	CANCELLED: 'cancelled',
} as const;

export type KotStatus = (typeof KOT_STATUS)[keyof typeof KOT_STATUS];

export const RESERVATION_STATUS = {
	CONFIRMED: 'confirmed',
	SEATED: 'seated',
	COMPLETED: 'completed',
	NO_SHOW: 'no_show',
	CANCELLED: 'cancelled',
} as const;

export type ReservationStatus = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

export const AUDIT_ACTION = {
	INSERT: 'INSERT',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	LOGIN: 'LOGIN',
	LOGOUT: 'LOGOUT',
	VOID: 'VOID',
	REFUND: 'REFUND',
	PRINT: 'PRINT',
	OPEN_DRAWER: 'OPEN_DRAWER',
	OVERRIDE: 'OVERRIDE',
	STATUS_CHANGE: 'STATUS_CHANGE',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const DEVICE_STATUS = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
} as const;

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS];

export const CASH_TRANSACTION_TYPE = {
	CASH_IN: 'cash_in',
	CASH_OUT: 'cash_out',
} as const;

export type CashTransactionType = (typeof CASH_TRANSACTION_TYPE)[keyof typeof CASH_TRANSACTION_TYPE];

export const CASH_TRANSACTION_REASON = {
	OWNER_WITHDRAWAL: 'owner_withdrawal',
	SUPPLY_PURCHASE: 'supply_purchase',
	STAFF_ADVANCE: 'staff_advance',
	PETTY_CASH: 'petty_cash',
	ANGSURAN: 'angsuran',
	CASH_DEPOSIT: 'cash_deposit',
	OPERASIONAL: 'operasional',
	OTHER: 'other',
} as const;

export type CashTransactionReason = (typeof CASH_TRANSACTION_REASON)[keyof typeof CASH_TRANSACTION_REASON];

export const MOVEMENT_TYPE = {
	ORDER_DEDUCTION: 'order_deduction',
	ORDER_CANCELLATION: 'order_cancellation',
	ORDER_ADJUSTMENT: 'order_adjustment',
	PURCHASE_ADDITION: 'purchase_addition',
	MANUAL_ADJUSTMENT: 'manual_adjustment',
} as const;

export type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];
