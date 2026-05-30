-- 008_add_inventory_stock_trigger_prod.sql
-- Production schema (pos_tempest_prod) variant.
-- Two triggers work together so stock always equals SUM(quantity_change).

SET search_path TO pos_tempest_prod;

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

-- Existing drift is fixed by the companion migration 009_fix_inventory_ledger_sync_prod.sql.
