-- 008_add_inventory_stock_trigger_prod.sql
-- Production schema (pos_tempest_prod) variant of the inventory stock trigger.
-- Makes inventories.stock_quantity authoritative on the server by recomputing
-- it from the inventory_movements ledger on every INSERT / UPDATE.

SET search_path TO pos_tempest_prod;

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
