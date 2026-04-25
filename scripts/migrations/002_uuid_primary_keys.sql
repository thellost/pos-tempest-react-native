-- 002_uuid_primary_keys.sql
-- Migrates selected high-write tables from INTEGER PK to UUID PK to eliminate
-- offline-first ID collisions across PowerSync mobile devices.
-- Idempotent — safe to re-run. Wrap entire body in BEGIN/COMMIT.
--
-- Tables migrating PK to UUID:
--   shifts, kitchen_order_tickets, order_items, kot_items,
--   order_item_modifiers, payments, order_discounts,
--   shift_cash_transactions, inventory_movements
--
-- FK ripple effects (column type INT → UUID):
--   orders.shift_id, payments.shift_id, shift_cash_transactions.shift_id,
--   order_item_modifiers.order_item_id, kot_items.order_item_id, kot_items.kot_id

BEGIN;
SET search_path TO pos_tempest;

-- ============================================================
-- 0. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- STEP 1: ADD new_id UUID COLUMNS TO ALL 9 MIGRATING TABLES
--         (idempotent — skipped if column already exists)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'shifts' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE shifts ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'kitchen_order_tickets' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE kitchen_order_tickets ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_items' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'kot_items' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE kot_items ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_item_modifiers' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE order_item_modifiers ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'payments' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_discounts' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE order_discounts ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'shift_cash_transactions' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE shift_cash_transactions ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'inventory_movements' AND column_name = 'new_id'
  ) THEN
    ALTER TABLE inventory_movements ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

-- ============================================================
-- STEP 2: ADD NEW UUID FK STAGING COLUMNS ON REFERENCING TABLES
--         These shadow the current integer FK columns and will
--         be backfilled in step 3 before the old columns drop.
-- ============================================================

-- orders.shift_id  INT → UUID
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'orders' AND column_name = 'new_shift_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN new_shift_id uuid;
  END IF;
END $$;

-- payments.shift_id  INT → UUID
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'payments' AND column_name = 'new_shift_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN new_shift_id uuid;
  END IF;
END $$;

-- shift_cash_transactions.shift_id  INT → UUID
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'shift_cash_transactions' AND column_name = 'new_shift_id'
  ) THEN
    ALTER TABLE shift_cash_transactions ADD COLUMN new_shift_id uuid;
  END IF;
END $$;

-- order_item_modifiers.order_item_id  INT → UUID
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_item_modifiers' AND column_name = 'new_order_item_id'
  ) THEN
    ALTER TABLE order_item_modifiers ADD COLUMN new_order_item_id uuid;
  END IF;
END $$;

-- kot_items.kot_id  INT → UUID (references kitchen_order_tickets)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'kot_items' AND column_name = 'new_kot_id'
  ) THEN
    ALTER TABLE kot_items ADD COLUMN new_kot_id uuid;
  END IF;
END $$;

-- kot_items.order_item_id  INT → UUID (references order_items)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'kot_items' AND column_name = 'new_order_item_id'
  ) THEN
    ALTER TABLE kot_items ADD COLUMN new_order_item_id uuid;
  END IF;
END $$;

-- ============================================================
-- STEP 3: PRE-FLIGHT INTEGRITY CHECKS
--         Abort early if non-nullable FK columns have orphans.
--         Nullable FKs (orders.shift_id, payments.shift_id) are
--         allowed to be NULL — no check required for those.
-- ============================================================

DO $$ DECLARE cnt INTEGER; BEGIN
  SELECT count(*) INTO cnt
  FROM shift_cash_transactions sct
  LEFT JOIN shifts s ON sct.shift_id = s.id
  WHERE s.id IS NULL;
  IF cnt > 0 THEN
    RAISE EXCEPTION
      'Pre-flight failed: % shift_cash_transactions row(s) reference a non-existent shifts.id', cnt;
  END IF;
END $$;

DO $$ DECLARE cnt INTEGER; BEGIN
  SELECT count(*) INTO cnt
  FROM kot_items ki
  LEFT JOIN kitchen_order_tickets k ON ki.kot_id = k.id
  WHERE k.id IS NULL;
  IF cnt > 0 THEN
    RAISE EXCEPTION
      'Pre-flight failed: % kot_items row(s) reference a non-existent kitchen_order_tickets.id', cnt;
  END IF;
END $$;

DO $$ DECLARE cnt INTEGER; BEGIN
  SELECT count(*) INTO cnt
  FROM kot_items ki
  LEFT JOIN order_items oi ON ki.order_item_id = oi.id
  WHERE oi.id IS NULL;
  IF cnt > 0 THEN
    RAISE EXCEPTION
      'Pre-flight failed: % kot_items row(s) reference a non-existent order_items.id', cnt;
  END IF;
END $$;

DO $$ DECLARE cnt INTEGER; BEGIN
  SELECT count(*) INTO cnt
  FROM order_item_modifiers oim
  LEFT JOIN order_items oi ON oim.order_item_id = oi.id
  WHERE oi.id IS NULL;
  IF cnt > 0 THEN
    RAISE EXCEPTION
      'Pre-flight failed: % order_item_modifiers row(s) reference a non-existent order_items.id', cnt;
  END IF;
END $$;

-- ============================================================
-- STEP 4: BACKFILL — populate staging UUID FK columns
--         "IS NULL" guard makes each UPDATE idempotent; rows
--         already backfilled on a prior run are not touched.
--         NOTE: JOINs use the OLD integer id columns which are
--         still present at this point.
-- ============================================================

-- shifts → orders.new_shift_id (nullable source; preserve NULL)
UPDATE orders
SET    new_shift_id = s.new_id
FROM   shifts s
WHERE  orders.shift_id = s.id
  AND  orders.new_shift_id IS NULL
  AND  orders.shift_id IS NOT NULL;

-- shifts → payments.new_shift_id (nullable source)
UPDATE payments
SET    new_shift_id = s.new_id
FROM   shifts s
WHERE  payments.shift_id = s.id
  AND  payments.new_shift_id IS NULL
  AND  payments.shift_id IS NOT NULL;

-- shifts → shift_cash_transactions.new_shift_id (NOT NULL source — validated above)
UPDATE shift_cash_transactions
SET    new_shift_id = s.new_id
FROM   shifts s
WHERE  shift_cash_transactions.shift_id = s.id
  AND  shift_cash_transactions.new_shift_id IS NULL;

-- kitchen_order_tickets → kot_items.new_kot_id
UPDATE kot_items
SET    new_kot_id = k.new_id
FROM   kitchen_order_tickets k
WHERE  kot_items.kot_id = k.id
  AND  kot_items.new_kot_id IS NULL;

-- order_items → order_item_modifiers.new_order_item_id
UPDATE order_item_modifiers
SET    new_order_item_id = oi.new_id
FROM   order_items oi
WHERE  order_item_modifiers.order_item_id = oi.id
  AND  order_item_modifiers.new_order_item_id IS NULL;

-- order_items → kot_items.new_order_item_id
UPDATE kot_items
SET    new_order_item_id = oi.new_id
FROM   order_items oi
WHERE  kot_items.order_item_id = oi.id
  AND  kot_items.new_order_item_id IS NULL;

-- ============================================================
-- STEP 5: SWAP COLUMNS — dependency-safe order
--         Parent tables first (shifts, kitchen_order_tickets,
--         order_items), then children that reference them.
--         For PK tables: drop old int id, rename new_id → id.
--         For FK columns: drop old int col, rename new_col.
--         Dropping the old column automatically drops all
--         indexes that referenced it.
-- ============================================================

-- ---------------------------------------------------------
-- 5a. shifts — PK only
--     Referenced by: orders.shift_id, payments.shift_id,
--                    shift_cash_transactions.shift_id
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'shifts'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    -- CASCADE: also drops dependent FK constraints on
    -- orders.shift_id, payments.shift_id, shift_cash_transactions.shift_id.
    -- Those FKs are recreated in STEP 6 against the new UUID columns.
    ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_pkey CASCADE;
    ALTER TABLE shifts DROP COLUMN id;
    ALTER TABLE shifts RENAME COLUMN new_id TO id;
    ALTER TABLE shifts ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Recreate indexes on shifts that survived (none referenced old int id)
-- Existing indexes: (user_id,branch_id,opened_at), (device_id,status), (status)
-- — these reference other columns and were not dropped. No action needed.

-- ---------------------------------------------------------
-- 5b. kitchen_order_tickets — PK only
--     Referenced by: kot_items.kot_id
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'kitchen_order_tickets'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    -- CASCADE: also drops dependent FK kot_items.kot_id_fkey.
    -- Recreated in STEP 6 against the new UUID columns.
    ALTER TABLE kitchen_order_tickets DROP CONSTRAINT IF EXISTS kitchen_order_tickets_pkey CASCADE;
    ALTER TABLE kitchen_order_tickets DROP COLUMN id;
    ALTER TABLE kitchen_order_tickets RENAME COLUMN new_id TO id;
    ALTER TABLE kitchen_order_tickets ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Recreate indexes that survive (order_id, status, status+priority are uuid/text columns)
CREATE INDEX IF NOT EXISTS idx_kitchen_order_tickets_order_id       ON kitchen_order_tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_tickets_status         ON kitchen_order_tickets (status);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_tickets_status_priority ON kitchen_order_tickets (status, priority);

-- ---------------------------------------------------------
-- 5c. order_items — PK only
--     Referenced by: order_item_modifiers.order_item_id,
--                    kot_items.order_item_id
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_items'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    -- CASCADE: also drops dependent FKs
    -- order_item_modifiers.order_item_id_fkey and kot_items.order_item_id_fkey.
    -- Recreated in STEP 6 against the new UUID columns.
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_pkey CASCADE;
    ALTER TABLE order_items DROP COLUMN id;
    ALTER TABLE order_items RENAME COLUMN new_id TO id;
    ALTER TABLE order_items ADD PRIMARY KEY (id);
  END IF;
END $$;

-- order_id and menu_item_id indexes survive (those columns were not dropped)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id     ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items (menu_item_id);

-- ---------------------------------------------------------
-- 5d. kot_items — PK + both FK columns
--     Depends on: kitchen_order_tickets (5b), order_items (5c)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'kot_items'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    ALTER TABLE kot_items DROP CONSTRAINT IF EXISTS kot_items_pkey;
    -- Drop old integer FK columns (their indexes are auto-dropped)
    ALTER TABLE kot_items DROP COLUMN IF EXISTS kot_id;
    ALTER TABLE kot_items DROP COLUMN IF EXISTS order_item_id;
    -- Drop old integer PK column
    ALTER TABLE kot_items DROP COLUMN id;
    -- Rename staging columns to final names
    ALTER TABLE kot_items RENAME COLUMN new_id           TO id;
    ALTER TABLE kot_items RENAME COLUMN new_kot_id       TO kot_id;
    ALTER TABLE kot_items RENAME COLUMN new_order_item_id TO order_item_id;
    -- Restore NOT NULL constraints (staging columns were added nullable)
    ALTER TABLE kot_items ALTER COLUMN kot_id        SET NOT NULL;
    ALTER TABLE kot_items ALTER COLUMN order_item_id SET NOT NULL;
    -- Add new primary key
    ALTER TABLE kot_items ADD PRIMARY KEY (id);
    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_kot_items_kot_id        ON kot_items (kot_id);
    CREATE INDEX IF NOT EXISTS idx_kot_items_order_item_id ON kot_items (order_item_id);
  END IF;
END $$;

-- ---------------------------------------------------------
-- 5e. order_item_modifiers — PK + order_item_id FK
--     Depends on: order_items (5c)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_item_modifiers'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    ALTER TABLE order_item_modifiers DROP CONSTRAINT IF EXISTS order_item_modifiers_pkey;
    -- Drop old integer FK column (its index is auto-dropped)
    ALTER TABLE order_item_modifiers DROP COLUMN IF EXISTS order_item_id;
    -- Drop old integer PK column
    ALTER TABLE order_item_modifiers DROP COLUMN id;
    -- Rename staging columns
    ALTER TABLE order_item_modifiers RENAME COLUMN new_id            TO id;
    ALTER TABLE order_item_modifiers RENAME COLUMN new_order_item_id TO order_item_id;
    -- Restore NOT NULL
    ALTER TABLE order_item_modifiers ALTER COLUMN order_item_id SET NOT NULL;
    -- Add primary key
    ALTER TABLE order_item_modifiers ADD PRIMARY KEY (id);
    -- Recreate index
    CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_order_item_id
      ON order_item_modifiers (order_item_id);
  END IF;
END $$;

-- ---------------------------------------------------------
-- 5f. payments — PK + shift_id FK
--     Depends on: shifts (5a)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'payments'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_pkey;
    -- Drop old integer FK column (its index is auto-dropped)
    ALTER TABLE payments DROP COLUMN IF EXISTS shift_id;
    -- Drop old integer PK column
    ALTER TABLE payments DROP COLUMN id;
    -- Rename staging columns
    ALTER TABLE payments RENAME COLUMN new_id       TO id;
    ALTER TABLE payments RENAME COLUMN new_shift_id TO shift_id;
    -- shift_id is nullable in original schema — no SET NOT NULL needed
    -- Add primary key
    ALTER TABLE payments ADD PRIMARY KEY (id);
    -- Recreate index on migrated FK column
    CREATE INDEX IF NOT EXISTS idx_payments_shift_id ON payments (shift_id);
  END IF;
END $$;

-- Recreate non-migrated indexes that survive (order_id uuid column was not dropped)
CREATE INDEX IF NOT EXISTS idx_payments_order_id       ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments (payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at        ON payments (paid_at);

-- ---------------------------------------------------------
-- 5g. order_discounts — PK only (order_id already uuid)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'order_discounts'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    ALTER TABLE order_discounts DROP CONSTRAINT IF EXISTS order_discounts_pkey;
    ALTER TABLE order_discounts DROP COLUMN id;
    ALTER TABLE order_discounts RENAME COLUMN new_id TO id;
    ALTER TABLE order_discounts ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Recreate non-migrated indexes
CREATE INDEX IF NOT EXISTS idx_order_discounts_order_id    ON order_discounts (order_id);
CREATE INDEX IF NOT EXISTS idx_order_discounts_discount_id ON order_discounts (discount_id);

-- ---------------------------------------------------------
-- 5h. shift_cash_transactions — PK + shift_id FK
--     Depends on: shifts (5a)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'shift_cash_transactions'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    ALTER TABLE shift_cash_transactions DROP CONSTRAINT IF EXISTS shift_cash_transactions_pkey;
    -- Drop old integer FK column (its index is auto-dropped)
    ALTER TABLE shift_cash_transactions DROP COLUMN IF EXISTS shift_id;
    -- Drop old integer PK column
    ALTER TABLE shift_cash_transactions DROP COLUMN id;
    -- Rename staging columns
    ALTER TABLE shift_cash_transactions RENAME COLUMN new_id       TO id;
    ALTER TABLE shift_cash_transactions RENAME COLUMN new_shift_id TO shift_id;
    -- Restore NOT NULL (shift_id was NOT NULL in original schema)
    ALTER TABLE shift_cash_transactions ALTER COLUMN shift_id SET NOT NULL;
    -- Add primary key
    ALTER TABLE shift_cash_transactions ADD PRIMARY KEY (id);
    -- Recreate index on migrated FK column
    CREATE INDEX IF NOT EXISTS idx_shift_cash_transactions_shift_id
      ON shift_cash_transactions (shift_id);
  END IF;
END $$;

-- Recreate non-migrated indexes
CREATE INDEX IF NOT EXISTS idx_shift_cash_transactions_user_id    ON shift_cash_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_shift_cash_transactions_type       ON shift_cash_transactions (type);
CREATE INDEX IF NOT EXISTS idx_shift_cash_transactions_created_at ON shift_cash_transactions (created_at);

-- ---------------------------------------------------------
-- 5i. inventory_movements — PK only (no FK cols migrating)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'inventory_movements'
      AND column_name = 'id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_pkey;
    ALTER TABLE inventory_movements DROP COLUMN id;
    ALTER TABLE inventory_movements RENAME COLUMN new_id TO id;
    ALTER TABLE inventory_movements ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Recreate non-migrated indexes
CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory_id ON inventory_movements (inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference    ON inventory_movements (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at  ON inventory_movements (created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type ON inventory_movements (movement_type);

-- ---------------------------------------------------------
-- 5j. orders — FK column only (orders.id is already uuid)
--     Depends on: shifts (5a)
-- ---------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pos_tempest' AND table_name = 'orders'
      AND column_name = 'shift_id' AND data_type IN ('integer','bigint','smallint')
  ) THEN
    -- Drop old integer FK column (its index is auto-dropped)
    ALTER TABLE orders DROP COLUMN shift_id;
    ALTER TABLE orders RENAME COLUMN new_shift_id TO shift_id;
    -- shift_id is nullable in original schema — no SET NOT NULL needed
    CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders (shift_id);
  END IF;
END $$;

-- Recreate all orders indexes that could have been implicitly touched
-- (most survive since they reference columns other than shift_id)
CREATE INDEX IF NOT EXISTS idx_orders_branch_created     ON orders (branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_id           ON orders (table_id);
CREATE INDEX IF NOT EXISTS idx_orders_cashier_id         ON orders (cashier_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id        ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status             ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status     ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_type         ON orders (order_type);
CREATE INDEX IF NOT EXISTS idx_orders_branch_status_date ON orders (branch_id, status, created_at);

-- ============================================================
-- STEP 6: RECREATE FOREIGN KEY CONSTRAINTS
--         The CASCADE drops in 5a/5b/5c removed the old integer
--         FK constraints from child tables. Recreate them now
--         against the new UUID parent PKs. Idempotent — guarded
--         by pg_constraint lookup.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shift_id_fkey' AND connamespace = 'pos_tempest'::regnamespace
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_shift_id_fkey
      FOREIGN KEY (shift_id) REFERENCES shifts (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_shift_id_fkey' AND connamespace = 'pos_tempest'::regnamespace
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_shift_id_fkey
      FOREIGN KEY (shift_id) REFERENCES shifts (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_cash_transactions_shift_id_fkey' AND connamespace = 'pos_tempest'::regnamespace
  ) THEN
    ALTER TABLE shift_cash_transactions
      ADD CONSTRAINT shift_cash_transactions_shift_id_fkey
      FOREIGN KEY (shift_id) REFERENCES shifts (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kot_items_kot_id_fkey' AND connamespace = 'pos_tempest'::regnamespace
  ) THEN
    ALTER TABLE kot_items
      ADD CONSTRAINT kot_items_kot_id_fkey
      FOREIGN KEY (kot_id) REFERENCES kitchen_order_tickets (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kot_items_order_item_id_fkey' AND connamespace = 'pos_tempest'::regnamespace
  ) THEN
    ALTER TABLE kot_items
      ADD CONSTRAINT kot_items_order_item_id_fkey
      FOREIGN KEY (order_item_id) REFERENCES order_items (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_item_modifiers_order_item_id_fkey' AND connamespace = 'pos_tempest'::regnamespace
  ) THEN
    ALTER TABLE order_item_modifiers
      ADD CONSTRAINT order_item_modifiers_order_item_id_fkey
      FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
