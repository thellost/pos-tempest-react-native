-- 009_fix_inventory_ledger_sync_prod.sql
-- Production schema (pos_tempest_prod) variant.
-- One-time data fix: sync the movement ledger to match current stock_quantity.
-- Run AFTER deploying the new trigger from migration 008.
--
-- IMPORTANT: run 008_add_inventory_stock_trigger_prod.sql FIRST, then this file.

SET search_path TO pos_tempest_prod;

BEGIN;

-- ═══ Step 0: snapshot current stock values ═══
CREATE TEMP TABLE stock_snapshot AS
SELECT id, stock_quantity FROM inventories;

SELECT 'Snapshotted ' || COUNT(*) || ' inventory rows' AS notice FROM stock_snapshot;

-- ═══ Step 1: delete duplicate adjustment rows ═══
WITH duplicates AS (
  SELECT
    id,
    inventory_id,
    created_at,
    LAG(created_at) OVER (
      PARTITION BY inventory_id, quantity_change, quantity_before, quantity_after
      ORDER BY created_at
    ) AS prev_ts
  FROM inventory_movements
),
to_delete AS (
  SELECT id FROM duplicates
  WHERE prev_ts IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_ts)) < 5
)
DELETE FROM inventory_movements
WHERE id IN (SELECT id FROM to_delete);

-- ═══ Step 2: insert compensating initial-balance adjustments ═══
INSERT INTO inventory_movements (
  id, inventory_id, user_id, movement_type, quantity_change,
  quantity_before, quantity_after, reference_type, reference_id, reason, created_at
)
SELECT
  gen_random_uuid(),
  i.id,
  6,
  'adjustment',
  s.stock_quantity - COALESCE(SUM(im.quantity_change), 0),
  COALESCE(SUM(im.quantity_change), 0),
  s.stock_quantity,
  'manual',
  NULL,
  '009: sync ledger to stock',
  '1970-01-02 00:00:01'
FROM stock_snapshot s
JOIN inventories i ON i.id = s.id
LEFT JOIN inventory_movements im ON im.inventory_id = i.id
GROUP BY i.id, s.stock_quantity
HAVING s.stock_quantity IS DISTINCT FROM COALESCE(SUM(im.quantity_change), 0);

-- ═══ Step 3: verify zero drift ═══
DO $$
DECLARE
  mismatch_count integer;
  drift_report text;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM inventories i
  WHERE i.stock_quantity IS DISTINCT FROM (
    SELECT COALESCE(SUM(im2.quantity_change), 0)
    FROM inventory_movements im2
    WHERE im2.inventory_id = i.id
  );

  IF mismatch_count > 0 THEN
    FOR drift_report IN
      SELECT format('  inventory %s: stock=%s ledger=%s drift=%s',
        i.id, i.stock_quantity,
        COALESCE(SUM(im.quantity_change), 0),
        i.stock_quantity - COALESCE(SUM(im.quantity_change), 0))
      FROM inventories i
      LEFT JOIN inventory_movements im ON im.inventory_id = i.id
      GROUP BY i.id
      HAVING i.stock_quantity IS DISTINCT FROM COALESCE(SUM(im.quantity_change), 0)
    LOOP
      RAISE WARNING '%', drift_report;
    END LOOP;
    ROLLBACK;
    RAISE EXCEPTION 'Fix failed: % inventory rows still have drift. Transaction rolled back.', mismatch_count;
  END IF;

  RAISE NOTICE 'Verification passed: 0 rows with drift. All clean!';
END;
$$;

DROP TABLE stock_snapshot;

COMMIT;
