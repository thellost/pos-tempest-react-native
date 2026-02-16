import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import {
    PowerSyncBackendConnector,
    PowerSyncDatabase,
    Schema,
    Table,
    column,
} from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

const schema = new Schema({
  // ===== User & Branch context =====
  roles: new Table({
    name: column.text,
    description: column.text,
    created_at: column.text,
    updated_at: column.text,
  }),
  users: new Table({
    supabase_auth_id: column.text,
    role_id: column.integer,
    branch_id: column.integer,
    name: column.text,
    email: column.text,
    phone: column.text,
    pin_code: column.text,
    avatar_url: column.text,
    is_active: column.integer,
    last_login_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  }),
  shifts: new Table({
    user_id: column.integer,
    branch_id: column.integer,
    status: column.text,
    opening_cash: column.real,
    closing_cash: column.real,
    expected_cash: column.real,
    cash_difference: column.real,
    opened_at: column.text,
    closed_at: column.text,
    notes: column.text,
  }),
  branches: new Table({
    name: column.text,
    address: column.text,
    phone: column.text,
    tax_rate: column.real,
    service_charge_rate: column.real,
    currency: column.text,
    timezone: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  floor_areas: new Table({
    branch_id: column.integer,
    name: column.text,
    sort_order: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  tables: new Table({
    branch_id: column.integer,
    floor_area_id: column.integer,
    table_number: column.text,
    capacity: column.integer,
    status: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),

  // ===== Menu catalog =====
  categories: new Table({
    parent_id: column.integer,
    name: column.text,
    description: column.text,
    sort_order: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  menu_items: new Table({
    category_id: column.integer,
    name: column.text,
    description: column.text,
    sku: column.text,
    barcode: column.text,
    image_url: column.text,
    pricing_type: column.text,
    unit_of_measure: column.text,
    price: column.real,
    cost: column.real,
    min_order_qty: column.real,
    preparation_time_minutes: column.integer,
    is_available: column.integer,
    is_active: column.integer,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  modifier_groups: new Table({
    name: column.text,
    description: column.text,
    is_required: column.integer,
    min_selections: column.integer,
    max_selections: column.integer,
    sort_order: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  modifiers: new Table({
    modifier_group_id: column.integer,
    name: column.text,
    extra_price: column.real,
    sort_order: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  menu_item_modifier_groups: new Table({
    menu_item_id: column.integer,
    modifier_group_id: column.integer,
    sort_order: column.integer,
  }),

  // ===== Orders =====
  orders: new Table({
    order_number: column.text,
    branch_id: column.integer,
    table_id: column.integer,
    cashier_id: column.integer,
    customer_id: column.integer,
    shift_id: column.integer,
    order_type: column.text,
    status: column.text,
    guest_count: column.integer,
    subtotal: column.real,
    discount_amount: column.real,
    tax_amount: column.real,
    service_charge: column.real,
    rounding_amount: column.real,
    total: column.real,
    payment_status: column.text,
    notes: column.text,
    voided_by: column.integer,
    voided_at: column.text,
    void_reason: column.text,
    created_at: column.text,
    updated_at: column.text,
  }),
  order_items: new Table({
    order_id: column.integer,
    menu_item_id: column.integer,
    menu_item_name: column.text,
    quantity: column.real,
    unit_of_measure: column.text,
    unit_price: column.real,
    modifier_total: column.real,
    subtotal: column.real,
    discount_amount: column.real,
    total: column.real,
    notes: column.text,
    is_voided: column.integer,
    voided_by: column.integer,
    void_reason: column.text,
    created_at: column.text,
  }),
  order_item_modifiers: new Table({
    order_item_id: column.integer,
    modifier_id: column.integer,
    modifier_name: column.text,
    modifier_group_name: column.text,
    extra_price: column.real,
  }),

  // ===== Kitchen =====
  kitchen_order_tickets: new Table({
    order_id: column.integer,
    ticket_number: column.text,
    status: column.text,
    priority: column.integer,
    printed_at: column.text,
    started_at: column.text,
    completed_at: column.text,
    created_at: column.text,
  }),
  kot_items: new Table({
    kot_id: column.integer,
    order_item_id: column.integer,
    quantity: column.real,
    status: column.text,
    notes: column.text,
  }),

  // ===== Payment & discount =====
  payments: new Table({
    order_id: column.integer,
    shift_id: column.integer,
    payment_method: column.text,
    amount: column.real,
    change_amount: column.real,
    reference_number: column.text,
    paid_at: column.text,
  }),
  discounts: new Table({
    name: column.text,
    description: column.text,
    discount_type: column.text,
    value: column.real,
    min_order_amount: column.real,
    max_discount_amount: column.real,
    valid_from: column.text,
    valid_until: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),
  order_discounts: new Table({
    order_id: column.integer,
    discount_id: column.integer,
    discount_name: column.text,
    discount_type: column.text,
    discount_value: column.real,
    applied_amount: column.real,
    applied_by: column.integer,
    created_at: column.text,
  }),

  // ===== Tax =====
  tax_configs: new Table({
    branch_id: column.integer,
    name: column.text,
    rate: column.real,
    is_inclusive: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  }),

  // ===== Audit (append-only) =====
  audit_logs: new Table({
    user_id: column.integer,
    branch_id: column.integer,
    action: column.text,
    table_name: column.text,
    record_id: column.integer,
    old_values: column.text,
    new_values: column.text,
    description: column.text,
    ip_address: column.text,
    user_agent: column.text,
    session_id: column.text,
    created_at: column.text,
  }),
});

export const powersync = new PowerSyncDatabase({
  database: new OPSqliteOpenFactory({ dbFilename: 'postempest.db' }),
  schema,
});

type JwtPayload = {
  aud?: string | string[];
  exp?: number;
  iat?: number;
  sub?: string;
};


function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const connector: PowerSyncBackendConnector = {
  fetchCredentials: async () => {
    const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
    const explicitToken = process.env.EXPO_PUBLIC_POWERSYNC_TOKEN;

    console.log('[PowerSync][fetchCredentials] called', {
      hasEndpoint: Boolean(endpoint),
      hasExplicitToken: Boolean(explicitToken),
    });

    if (!endpoint) {
      console.warn('[PowerSync][fetchCredentials] Missing EXPO_PUBLIC_POWERSYNC_URL');
      return null;
    }

    if (explicitToken) {
      return { endpoint, token: explicitToken };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn('[PowerSync][fetchCredentials] No Supabase access token in current session');
      return null;
    }

    return {
      endpoint,
      token: session.access_token,
    };
  },
  uploadData: async (database) => {
    const batch = await database.getCrudBatch(20);
    const hasPendingCrud = Boolean(batch);
    console.log('[PowerSync][uploadData] called', { hasPendingCrud });

    // This project currently does not upload CRUD to backend.
    if (batch) {
      console.warn('[PowerSync][uploadData] Pending CRUD exists but upload handler is a no-op.', {
        count: batch.crud.length,
        haveMore: batch.haveMore,
        sample: batch.crud.slice(0, 3).map((entry) => ({
          table: entry.table,
          op: entry.op,
          id: entry.id,
          keys: Object.keys(entry.opData ?? {}),
        })),
      });

      try {
        // Note: some RN builds error when undefined is passed over the native bridge for writeCheckpoint.
        // Pass an explicit string to avoid "Value is undefined, expected a String".
        await batch.complete('noop-checkpoint');
      } catch (error) {
        console.error('[PowerSync][uploadData] batch.complete() failed', {
          message: safeMessage(error),
        });
        throw error;
      }
    }

    // For this demo, we only read synced data.
  },
};

let initialized = false;
let connected = false;


export async function initializePowerSync() {
  if (!initialized) {
    console.log('[PowerSync][init] Initializing local database...');
    initialized = true;
    await powersync.init();
    console.log('[PowerSync][init] Local database initialized.');
  }

  if (!connected && process.env.EXPO_PUBLIC_POWERSYNC_URL) {
    console.log('[PowerSync][connect] Attempting connection...', {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL,
      hasExplicitToken: Boolean(process.env.EXPO_PUBLIC_POWERSYNC_TOKEN),
    });

    connected = true;
    try {
      await powersync.connect(connector);
      console.log('[PowerSync][connect] connect() resolved.', {
        connected: powersync.connected,
        connecting: powersync.connecting,
      });
    } catch (error) {
      connected = false;
      console.error('[PowerSync][connect] connect() failed:', safeMessage(error));
      throw error;
    }
  } else if (!process.env.EXPO_PUBLIC_POWERSYNC_URL) {
    console.warn('[PowerSync][connect] Skipped: EXPO_PUBLIC_POWERSYNC_URL is missing.');
  }
}
