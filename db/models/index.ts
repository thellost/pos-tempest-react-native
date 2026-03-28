import type {
    AuditAction,
    CashTransactionReason,
    CashTransactionType,
    DeviceStatus,
    DiscountType,
    KotStatus,
    OrderStatus,
    OrderType,
    PaymentMethodType,
    PaymentStatus,
    PricingType,
    PurchaseStatus,
    ReservationStatus,
    RoleType,
    ShiftStatus,
    TableStatus,
    UnitOfMeasure
} from '@/constants/enums';

export type EntityId = number;
export type Timestamp = string;

export interface Role {
	id: EntityId;
	name: RoleType;
	description: string | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface User {
	id: EntityId;
	supabase_auth_id: string;
	role_id: EntityId;
	branch_id: EntityId;
	name: string;
	email: string | null;
	phone: string | null;
	pin_code: string | null;
	avatar_url: string | null;
	is_active: boolean;
	last_login_at: Timestamp | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Shift {
	id: EntityId;
	user_id: EntityId;
	branch_id: EntityId;
	status: ShiftStatus;
	opening_cash: number;
	closing_cash: number | null;
	expected_cash: number | null;
	cash_difference: number | null;
	opened_at: Timestamp;
	closed_at: Timestamp | null;
	notes: string | null;
}

export interface Branch {
	id: EntityId;
	name: string;
	address: string | null;
	phone: string | null;
	tax_rate: number;
	service_charge_rate: number;
	currency: string;
	timezone: string;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface FloorArea {
	id: EntityId;
	branch_id: EntityId;
	name: string;
	sort_order: number;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface DiningTable {
	id: EntityId;
	branch_id: EntityId;
	floor_area_id: EntityId;
	table_number: string;
	capacity: number;
	status: TableStatus;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Customer {
	id: EntityId;
	name: string;
	phone: string | null;
	email: string | null;
	address: string | null;
	loyalty_points: number;
	total_visits: number;
	total_spent: number;
	notes: string | null;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Reservation {
	id: EntityId;
	branch_id: EntityId;
	table_id: EntityId | null;
	customer_id: EntityId | null;
	customer_name: string;
	customer_phone: string | null;
	guest_count: number;
	reservation_datetime: Timestamp;
	duration_minutes: number;
	status: ReservationStatus;
	notes: string | null;
	created_by: EntityId;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Category {
	id: EntityId;
	parent_id: EntityId | null;
	name: string;
	description: string | null;
	sort_order: number;
	is_active: boolean;
	button_color: string | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface MenuItem {
	id: EntityId;
	category_id: EntityId | null;
	name: string;
	description: string | null;
	sku: string | null;
	barcode: string | null;
	image_url: string | null;
	pricing_type: PricingType;
	unit_of_measure: UnitOfMeasure;
	price: number;
	cost: number | null;
	min_order_qty: number;
	preparation_time_minutes: number | null;
	is_available: boolean;
	is_active: boolean;
	sort_order: number;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface ModifierGroup {
	id: EntityId;
	name: string;
	description: string | null;
	is_required: boolean;
	min_selections: number;
	max_selections: number;
	sort_order: number;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Modifier {
	id: EntityId;
	modifier_group_id: EntityId;
	name: string;
	extra_price: number;
	sort_order: number;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface MenuItemModifierGroup {
	id: EntityId;
	menu_item_id: EntityId;
	modifier_group_id: EntityId;
	sort_order: number;
}

export interface Inventory {
	id: EntityId;
	branch_id: EntityId;
	name: string;
	unit_of_measure: string;
	description: string | null;
	stock_quantity: number;
	low_stock_threshold: number | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface InventoryMovement {
	id: EntityId;
	inventory_id: EntityId;
	user_id: EntityId;
	movement_type: string;
	quantity_change: number;
	quantity_before: number;
	quantity_after: number;
	reference_type: string | null;
	reference_id: EntityId | null;
	reason: string | null;
	created_at: Timestamp;
}

export interface MenuItemIngredient {
	id: EntityId;
	menu_item_id: EntityId;
	inventory_id: EntityId;
	quantity_needed: number;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Order {
	id: EntityId;
	order_number: string;
	branch_id: EntityId;
	table_id: EntityId | null;
	cashier_id: EntityId;
	customer_id: EntityId | null;
	shift_id: EntityId | null;
	order_type: OrderType;
	status: OrderStatus;
	guest_count: number | null;
	subtotal: number;
	discount_amount: number;
	tax_amount: number;
	service_charge: number;
	rounding_amount: number;
	total: number;
	payment_status: PaymentStatus;
	notes: string | null;
	voided_by: EntityId | null;
	voided_at: Timestamp | null;
	void_reason: string | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface OrderItem {
	id: EntityId;
	order_id: EntityId;
	menu_item_id: EntityId;
	menu_item_name: string;
	quantity: number;
	unit_of_measure: UnitOfMeasure;
	unit_price: number;
	modifier_total: number;
	subtotal: number;
	discount_amount: number;
	total: number;
	notes: string | null;
	is_voided: boolean;
	voided_by: EntityId | null;
	void_reason: string | null;
	round_number: number | null;
	weight: number | null;
	created_at: Timestamp;
}

export interface OrderItemModifier {
	id: EntityId;
	order_item_id: EntityId;
	modifier_id: EntityId;
	modifier_name: string;
	modifier_group_name: string;
	extra_price: number;
}

export interface KitchenOrderTicket {
	id: EntityId;
	order_id: EntityId;
	ticket_number: string;
	status: KotStatus;
	priority: number;
	round_number: number | null;
	printed_at: Timestamp | null;
	started_at: Timestamp | null;
	completed_at: Timestamp | null;
	created_at: Timestamp;
}

export interface KotItem {
	id: EntityId;
	kot_id: EntityId;
	order_item_id: EntityId;
	quantity: number;
	status: KotStatus;
	notes: string | null;
}

export interface Payment {
	id: EntityId;
	order_id: EntityId;
	shift_id: EntityId | null;
	payment_method: PaymentMethodType;
	amount: number;
	change_amount: number;
	reference_number: string | null;
	paid_at: Timestamp;
}

export interface Discount {
	id: EntityId;
	name: string;
	description: string | null;
	discount_type: DiscountType;
	value: number;
	min_order_amount: number | null;
	max_discount_amount: number | null;
	valid_from: Timestamp | null;
	valid_until: Timestamp | null;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface OrderDiscount {
	id: EntityId;
	order_id: EntityId;
	discount_id: EntityId | null;
	discount_name: string;
	discount_type: DiscountType;
	discount_value: number;
	applied_amount: number;
	applied_by: EntityId;
	created_at: Timestamp;
}

export interface TaxConfig {
	id: EntityId;
	branch_id: EntityId;
	name: string;
	rate: number;
	is_inclusive: boolean;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Supplier {
	id: EntityId;
	name: string;
	contact_person: string | null;
	phone: string | null;
	email: string | null;
	address: string | null;
	is_active: boolean;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Purchase {
	id: EntityId;
	purchase_number: string;
	supplier_id: EntityId;
	branch_id: EntityId;
	ordered_by: EntityId;
	received_by: EntityId | null;
	subtotal: number;
	tax_amount: number;
	total: number;
	status: PurchaseStatus;
	notes: string | null;
	ordered_at: Timestamp;
	received_at: Timestamp | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface PurchaseItem {
	id: EntityId;
	purchase_id: EntityId;
	inventory_id: EntityId;
	quantity: number;
	unit_of_measure: UnitOfMeasure;
	cost_per_unit: number;
	total: number;
}

export interface AuditLog {
	id: string;
	user_id: EntityId | null;
	branch_id: EntityId | null;
	action: AuditAction;
	table_name: string;
	record_id: string | null;
	old_values: string | null;
	new_values: string | null;
	description: string | null;
	ip_address: string | null;
	user_agent: string | null;
	session_id: string | null;
	created_at: Timestamp;
}

export interface Device {
	id: string;
	branch_id: EntityId;
	device_name: string;
	status: DeviceStatus;
	registered_at: Timestamp;
	last_seen_at: Timestamp | null;
}

export interface ShiftCashTransaction {
	id: EntityId;
	shift_id: EntityId;
	user_id: EntityId;
	type: CashTransactionType;
	reason: CashTransactionReason;
	amount: number;
	note: string | null;
	created_at: Timestamp;
}

