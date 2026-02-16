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
  branches: new Table({
    name: column.text,
    address: column.text,
    timezone: column.text,
    is_active: column.integer,
  }),
  tables: new Table({
    branch_id: column.integer,
    floor_area_id: column.integer,
    table_number: column.text,
    capacity: column.integer,
    status: column.text,
    is_active: column.integer,
  }),
  orders: new Table({
    order_number: column.text,
    branch_id: column.integer,
    table_id: column.integer,
    status: column.text,
    total: column.real,
    payment_status: column.text,
    created_at: column.text,
  }),
  kitchen_order_tickets: new Table({
    order_id: column.integer,
    ticket_number: column.text,
    status: column.text,
    priority: column.integer,
    created_at: column.text,
  }),
  payments: new Table({
    order_id: column.integer,
    payment_method: column.text,
    amount: column.real,
    paid_at: column.text,
  }),
});

export const powersync = new PowerSyncDatabase({
  database: new OPSqliteOpenFactory({ dbFilename: 'postempest.db' }),
  schema,
});

const connector: PowerSyncBackendConnector = {
  fetchCredentials: async () => {
    const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
    const explicitToken = process.env.EXPO_PUBLIC_POWERSYNC_TOKEN;

    if (!endpoint) return null;

    if (explicitToken) {
      return { endpoint, token: explicitToken };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return null;

    return {
      endpoint,
      token: session.access_token,
    };
  },
  uploadData: async () => {
    // For this demo, we only read synced data.
  },
};

let initialized = false;
let connected = false;

async function seedIfEmpty() {
  const rows = await powersync.getAll<{ count: number }>('SELECT COUNT(*) as count FROM branches');
  const count = Number(rows[0]?.count ?? 0);

  if (count > 0) return;

  // Seed subset from documentation/PopulatedSQL so the demo UI has immediate data.
  await powersync.execute(
    'INSERT OR IGNORE INTO branches(id, name, address, timezone, is_active) VALUES (?, ?, ?, ?, ?)',
    ['1', 'Warung Terapung - Kemang', 'Jl. Kemang Raya No. 12, Jakarta Selatan', 'Asia/Jakarta', 1]
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO branches(id, name, address, timezone, is_active) VALUES (?, ?, ?, ?, ?)',
    ['2', 'Warung Terapung - Senopati', 'Jl. Senopati No. 45, Jakarta Selatan', 'Asia/Jakarta', 1]
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO branches(id, name, address, timezone, is_active) VALUES (?, ?, ?, ?, ?)',
    ['3', 'Warung Terapung - BSD', 'Ruko CBD Lot VII No. 8, BSD City, Tangerang', 'Asia/Jakarta', 1]
  );

  await powersync.execute(
    'INSERT OR IGNORE INTO tables(id, branch_id, floor_area_id, table_number, capacity, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['3', 1, 1, 'A3', 4, 'available', 1]
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO tables(id, branch_id, floor_area_id, table_number, capacity, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['15', 2, 4, 'A2', 4, 'occupied', 1]
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO tables(id, branch_id, floor_area_id, table_number, capacity, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['27', 3, 6, 'A4', 6, 'occupied', 1]
  );

  await powersync.execute(
    'INSERT OR IGNORE INTO orders(id, order_number, branch_id, table_id, status, total, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['1', 'ORD-20260212-001', 1, 3, 'completed', 200000, 'paid', '2026-02-12 09:15:00']
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO orders(id, order_number, branch_id, table_id, status, total, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['4', 'ORD-20260212-004', 2, 15, 'preparing', 250000, 'unpaid', '2026-02-12 12:30:00']
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO orders(id, order_number, branch_id, table_id, status, total, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['5', 'ORD-20260212-005', 3, 27, 'pending', 271000, 'unpaid', '2026-02-12 12:45:00']
  );

  await powersync.execute(
    'INSERT OR IGNORE INTO kitchen_order_tickets(id, order_id, ticket_number, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['4', 4, 'KOT-20260212-004', 'in_progress', 0, '2026-02-12 12:30:00']
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO kitchen_order_tickets(id, order_id, ticket_number, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['5', 5, 'KOT-20260212-005', 'pending', 0, '2026-02-12 12:45:00']
  );

  await powersync.execute(
    'INSERT OR IGNORE INTO payments(id, order_id, payment_method, amount, paid_at) VALUES (?, ?, ?, ?, ?)',
    ['1', 1, 'cash', 200000, '2026-02-12 09:45:00']
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO payments(id, order_id, payment_method, amount, paid_at) VALUES (?, ?, ?, ?, ?)',
    ['2', 2, 'qris', 400000, '2026-02-12 12:10:00']
  );
  await powersync.execute(
    'INSERT OR IGNORE INTO payments(id, order_id, payment_method, amount, paid_at) VALUES (?, ?, ?, ?, ?)',
    ['3', 2, 'cash', 71000, '2026-02-12 12:10:00']
  );
}

export async function initializePowerSync() {
  if (!initialized) {
    initialized = true;
    await powersync.init();
    await seedIfEmpty();
  }

  if (!connected && process.env.EXPO_PUBLIC_POWERSYNC_URL) {
    connected = true;
    try {
      await powersync.connect(connector);
    } catch {
      connected = false;
    }
  }
}
