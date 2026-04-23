-- 003_drop_order_items_fks.sql
-- Drops FK constraints on order_items so PowerSync uploads from offline
-- devices stop failing when they reference a menu_item / order that the
-- server no longer has. Trade-off: orphan rows are now possible.

SET search_path TO pos_tempest;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_inventory_id_fkey;

-- If your constraint names differ, find them with:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'pos_tempest.order_items'::regclass AND contype = 'f';
