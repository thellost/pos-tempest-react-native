-- 008_add_inventory_stock_trigger.sql
-- Makes inventories.stock_quantity authoritative on the server by recomputing
-- it from the inventory_movements ledger on every INSERT / UPDATE.
-- Clients can no longer corrupt stock with stale absolute values — the
-- server overrides whatever the client pushes with SUM(quantity_change).
-- This prevents the class of bug where sync races, direct DB access, or
-- multi-device conflicts cause stock_quantity to silently drift from the
-- movement ledger.

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

DROP TRIGGER IF EXISTS trg_inventories_stock_quantity ON inventories;
CREATE TRIGGER trg_inventories_stock_quantity
BEFORE INSERT OR UPDATE ON inventories
FOR EACH ROW EXECUTE FUNCTION recompute_stock_quantity();

-- Fix any existing drift immediately
UPDATE inventories
SET stock_quantity = sub.computed
FROM (
  SELECT
    i.id,
    COALESCE((SELECT SUM(im.quantity_change)
               FROM inventory_movements im
              WHERE im.inventory_id = i.id), 0) AS computed
  FROM inventories i
) sub
WHERE inventories.id = sub.id
  AND inventories.stock_quantity IS DISTINCT FROM sub.computed;
