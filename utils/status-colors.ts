import {
	KOT_STATUS,
	ORDER_STATUS,
	PURCHASE_STATUS,
	RESERVATION_STATUS,
	TABLE_STATUS,
} from '@/constants/enums';
import type {
	KotStatus,
	OrderStatus,
	PurchaseStatus,
	ReservationStatus,
	TableStatus,
} from '@/constants/enums';

export interface StatusStyle {
	/** NativeWind background className for a status badge */
	bg: string;
	/** NativeWind text color className for a status badge */
	text: string;
	/** Human-readable label for display */
	label: string;
}

/** Returns NativeWind bg+text className and label for a reservation status badge */
export function getReservationStatusStyle(status: ReservationStatus): StatusStyle {
	switch (status) {
		case RESERVATION_STATUS.CONFIRMED:
			return { bg: 'bg-brand/20', text: 'text-brand', label: 'Confirmed' };
		case RESERVATION_STATUS.SEATED:
			return { bg: 'bg-status-available/20', text: 'text-status-available', label: 'Seated' };
		case RESERVATION_STATUS.COMPLETED:
			return { bg: 'bg-surface-raised', text: 'text-pos-text-muted', label: 'Completed' };
		case RESERVATION_STATUS.NO_SHOW:
			return { bg: 'bg-pos-danger/20', text: 'text-pos-danger', label: 'No Show' };
		case RESERVATION_STATUS.CANCELLED:
			return { bg: 'bg-pos-danger/20', text: 'text-pos-danger', label: 'Cancelled' };
	}
}

/** Returns NativeWind bg+text className and label for a purchase order status badge */
export function getPOStatusStyle(status: PurchaseStatus): StatusStyle {
	switch (status) {
		case PURCHASE_STATUS.ORDERED:
			return { bg: 'bg-pos-warning-muted', text: 'text-pos-warning', label: 'Ordered' };
		case PURCHASE_STATUS.PARTIAL_RECEIVED:
			return { bg: 'bg-accent-muted', text: 'text-brand', label: 'Partial' };
		case PURCHASE_STATUS.RECEIVED:
			return { bg: 'bg-pos-success-muted', text: 'text-pos-success', label: 'Received' };
		case PURCHASE_STATUS.CANCELLED:
			return { bg: 'bg-surface-raised', text: 'text-pos-text-muted', label: 'Cancelled' };
	}
}

/** Returns NativeWind bg+text className and label for an order status badge */
export function getOrderStatusStyle(status: OrderStatus): StatusStyle {
	switch (status) {
		case ORDER_STATUS.PENDING:
			return { bg: 'bg-pos-warning-muted', text: 'text-pos-warning', label: 'Pending' };
		case ORDER_STATUS.CONFIRMED:
			return { bg: 'bg-brand/20', text: 'text-brand', label: 'Confirmed' };
		case ORDER_STATUS.PREPARING:
			return { bg: 'bg-accent-muted', text: 'text-brand', label: 'Preparing' };
		case ORDER_STATUS.READY:
			return { bg: 'bg-pos-success-muted', text: 'text-pos-success', label: 'Ready' };
		case ORDER_STATUS.SERVED:
			return { bg: 'bg-surface-raised', text: 'text-pos-text-muted', label: 'Served' };
		case ORDER_STATUS.COMPLETED:
			return { bg: 'bg-surface-raised', text: 'text-pos-text-muted', label: 'Completed' };
		case ORDER_STATUS.CANCELLED:
			return { bg: 'bg-pos-danger/20', text: 'text-pos-danger', label: 'Cancelled' };
	}
}

/** Returns NativeWind bg+text className and label for a KOT status badge */
export function getKOTStatusStyle(status: KotStatus): StatusStyle {
	switch (status) {
		case KOT_STATUS.PENDING:
			return { bg: 'bg-pos-warning-muted', text: 'text-pos-warning', label: 'Pending' };
		case KOT_STATUS.IN_PROGRESS:
			return { bg: 'bg-accent-muted', text: 'text-brand', label: 'In Progress' };
		case KOT_STATUS.READY:
			return { bg: 'bg-pos-success-muted', text: 'text-pos-success', label: 'Ready' };
		case KOT_STATUS.SERVED:
			return { bg: 'bg-surface-raised', text: 'text-pos-text-muted', label: 'Served' };
		case KOT_STATUS.CANCELLED:
			return { bg: 'bg-pos-danger/20', text: 'text-pos-danger', label: 'Cancelled' };
	}
}

/** Returns NativeWind bg+text className and label for a table status badge */
export function getTableStatusStyle(status: TableStatus): StatusStyle {
	switch (status) {
		case TABLE_STATUS.AVAILABLE:
			return { bg: 'bg-status-available-muted', text: 'text-status-available', label: 'Available' };
		case TABLE_STATUS.OCCUPIED:
			return { bg: 'bg-status-occupied-muted', text: 'text-status-occupied', label: 'Occupied' };
		case TABLE_STATUS.RESERVED:
			return { bg: 'bg-status-reserved-muted', text: 'text-status-reserved', label: 'Reserved' };
		case TABLE_STATUS.MAINTENANCE:
			return { bg: 'bg-status-maintenance-muted', text: 'text-status-maintenance', label: 'Maintenance' };
	}
}
