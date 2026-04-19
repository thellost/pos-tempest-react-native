-- Migration: Add waiter_id to orders table
-- Description: Tracks which staff member (waiter) took the order, separate from cashier.
-- The waiter_id is nullable since older orders won't have this field.
-- For backward compatibility, existing orders are backfilled with their cashier_id.

-- Step 1: Add the column
ALTER TABLE "orders" ADD COLUMN "waiter_id" integer;

-- Step 2: Add foreign key constraint
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_waiter" FOREIGN KEY ("waiter_id") REFERENCES "users" ("id");

-- Step 3: Backfill existing orders — assume the cashier also took the order
UPDATE "orders" SET "waiter_id" = "cashier_id" WHERE "waiter_id" IS NULL;

-- Step 4: Create index for waiter lookups
CREATE INDEX "idx_orders_waiter_id" ON "orders" ("waiter_id");
