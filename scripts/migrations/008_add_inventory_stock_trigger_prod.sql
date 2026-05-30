-- 008_add_inventory_stock_trigger_prod.sql
-- Production schema (pos_tempest_prod) variant of the inventory stock trigger.
-- Makes inventories.stock_quantity authoritative on the server by recomputing
-- it from the inventory_movements ledger after every movement INSERT / UPDATE / DELETE.
-- The trigger fires on inventory_movements (not inventories) so stock is always
-- reconciled with the full ledger — no one-row-behind drift like the old approach.

SET search_path TO pos_tempest_prod;

-- Drop old trigger + function in case this migration is re-run
DROP TRIGGER IF EXISTS trg_movements_recompute_stock ON inventory_movements;
DROP FUNCTION IF EXISTS recompute_stock_from_movements();
DROP TRIGGER IF EXISTS trg_inventories_stock_quantity ON inventories;
DROP FUNCTION IF EXISTS recompute_stock_quantity();

-- New function: recompute inventories.stock_quantity from the movement ledger
CREATE OR REPLACE FUNCTION recompute_stock_from_movements()
RETURNS TRIGGER AS $$
DECLARE
  target_id integer;
BEGIN
  -- INSERT / UPDATE: use NEW.inventory_id; DELETE: use OLD.inventory_id
  target_id := COALESCE(NEW.inventory_id, OLD.inventory_id);

  UPDATE inventories
  SET stock_quantity = (
    SELECT COALESCE(SUM(quantity_change), 0)
    FROM inventory_movements
    WHERE inventory_id = target_id
  ),
  updated_at = now()
  WHERE id = target_id;

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movements_recompute_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION recompute_stock_from_movements();

-- Existing drift is fixed by the companion migration 009_fix_inventory_ledger_sync_prod.sql.
-- That script snapshots current stock, deletes duplicate movement rows, inserts
-- compensating initial-balance adjustments, then verifies everything is clean.
-- Do NOT run a blind drift-fix here — it would overwrite correct stock values
-- with the broken ledger sum if duplicate movements exist.
