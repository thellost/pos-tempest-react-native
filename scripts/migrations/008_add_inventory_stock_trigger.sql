-- 008_add_inventory_stock_trigger.sql
-- Makes inventories.stock_quantity authoritative on the server. Two triggers
-- work together so stock always equals SUM(quantity_change) from the movement
-- ledger, regardless of sync ordering:
--
--   Trigger 1 (AFTER inventory_movements): recomputes stock when a movement row
--     is inserted, updated, or deleted. Catches the normal path.
--
--   Trigger 2 (BEFORE inventories): final gatekeeper — overrides whatever stock
--     value the client pushes with the ledger sum. Catches the stale-sync path
--     where an UPDATE arrives after the corresponding movement INSERT.

-- Drop everything in case this migration is re-run
DROP TRIGGER IF EXISTS trg_movements_recompute_stock ON inventory_movements;
DROP FUNCTION IF EXISTS recompute_stock_from_movements();
DROP TRIGGER IF EXISTS trg_inventories_stock_quantity ON inventories;
DROP FUNCTION IF EXISTS recompute_stock_quantity();

-- ─── Trigger 1: recompute stock AFTER any movement change ──────────────────
CREATE OR REPLACE FUNCTION recompute_stock_from_movements()
RETURNS TRIGGER AS $$
DECLARE
  target_id integer;
BEGIN
  target_id := COALESCE(NEW.inventory_id, OLD.inventory_id);
  UPDATE inventories
  SET stock_quantity = (
    SELECT COALESCE(SUM(quantity_change), 0)
    FROM inventory_movements
    WHERE inventory_id = target_id
  ),
  updated_at = now()
  WHERE id = target_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movements_recompute_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION recompute_stock_from_movements();

-- ─── Trigger 2: gatekeeper — override stale inventory UPDATEs ──────────────
CREATE OR REPLACE FUNCTION recompute_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.stock_quantity = (
    SELECT COALESCE(SUM(quantity_change), 0)
    FROM inventory_movements
    WHERE inventory_id = NEW.id
  );
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventories_stock_quantity
BEFORE INSERT OR UPDATE ON inventories
FOR EACH ROW EXECUTE FUNCTION recompute_stock_quantity();

-- Existing drift is fixed by the companion migration 009_fix_inventory_ledger_sync.sql.
