-- 009_fix_inventory_ledger_sync.sql
-- One-time data fix: sync the movement ledger to match current stock_quantity.
-- Run AFTER deploying the new trigger from migration 008.
--
-- Strategy:
--   1. Snapshot current stock_quantity (the "truth") before anything changes.
--   2. Delete duplicate adjustment rows (same before/after values within 5 s).
--   3. Insert compensating initial-balance adjustments so ledger SUM = stock.
--   4. Verify zero drift.
--
-- IMPORTANT: run 008_add_inventory_stock_trigger.sql FIRST, then this file.

BEGIN;

-- ═══ Step 0: snapshot current stock values ═══
CREATE TEMP TABLE stock_snapshot AS
SELECT id, stock_quantity FROM inventories;

SELECT 'Snapshotted ' || COUNT(*) || ' inventory rows' AS notice FROM stock_snapshot;

-- ═══ Step 1: delete duplicate adjustment rows ═══
-- A duplicate is two or more rows with the same inventory_id, quantity_change,
-- quantity_before, quantity_after inserted within 5 seconds of each other.
-- Only delete the older rows; keep the most recent one.
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
-- For every inventory where stock_quantity ≠ ledger SUM, create one adjustment
-- row with quantity_change = stock - SUM so the ledger matches.
-- The adjustment is backdated to 1970-01-02 so it sorts before real movements.
INSERT INTO inventory_movements (
  id, inventory_id, user_id, movement_type, quantity_change,
  quantity_before, quantity_after, reference_type, reference_id, reason, created_at
)
SELECT
  gen_random_uuid(),
  i.id,
  6,                         -- system user (adjust to your admin user_id if needed)
  'adjustment',
  s.stock_quantity - COALESCE(SUM(im.quantity_change), 0),
  COALESCE(SUM(im.quantity_change), 0),
  s.stock_quantity,
  'manual',
  NULL,
  '009: sync ledger to stock',
  '1970-01-02 00:00:01'     -- ancient timestamp so it sorts before real movements
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
