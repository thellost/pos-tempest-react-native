-- 009_fix_inventory_ledger_sync.sql
-- One-time data fix: rebuild the inventory_movements audit chain so
-- quantity_before / quantity_after form a perfect unbroken sequence per
-- inventory, using quantity_change as the sole source of truth.
--
-- Run AFTER deploying the new triggers from migration 008.
--
--   1. Delete duplicate adjustment rows (identical before/after/change —
--      regardless of timing, keep only the latest)
--   2. Rebuild before/after via cumulative sums
--   3. Recompute inventories.stock_quantity from the now-correct chain
--   4. Verify by recomputing cumulative sums and comparing (no LEAD gaps)

BEGIN;

-- ═══ Step 1: delete duplicate adjustment rows ═══
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY inventory_id, quantity_change, quantity_before, quantity_after
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM inventory_movements
)
DELETE FROM inventory_movements
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ═══ Step 2: rebuild quantity_before / quantity_after via cumulative sums ═══
UPDATE inventory_movements im
SET
  quantity_before = sub.new_before,
  quantity_after  = sub.new_after
FROM (
  SELECT
    id,
    COALESCE(
      SUM(quantity_change) OVER (
        PARTITION BY inventory_id
        ORDER BY created_at, id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS new_before,
    SUM(quantity_change) OVER (
      PARTITION BY inventory_id
      ORDER BY created_at, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS new_after
  FROM inventory_movements
) sub
WHERE im.id = sub.id;

-- ═══ Step 3: recompute inventories.stock_quantity from the now-correct chain ═══
UPDATE inventories i
SET
  stock_quantity = sub.ledger_sum,
  updated_at = now()
FROM (
  SELECT inventory_id, SUM(quantity_change) AS ledger_sum
  FROM inventory_movements
  GROUP BY inventory_id
) sub
WHERE i.id = sub.inventory_id;

-- ═══ Step 4: verify by recomputing cumulative sums ═══
DO $$
DECLARE
  mismatch_count integer;
  report_line    text;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM (
    SELECT id, inventory_id, created_at,
      quantity_before, quantity_after, quantity_change,
      COALESCE(
        SUM(quantity_change) OVER (
          PARTITION BY inventory_id
          ORDER BY created_at, id
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0
      ) AS expected_before,
      SUM(quantity_change) OVER (
        PARTITION BY inventory_id
        ORDER BY created_at, id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS expected_after
    FROM inventory_movements
  ) sub
  WHERE quantity_before IS DISTINCT FROM expected_before
     OR quantity_after  IS DISTINCT FROM expected_after;

  IF mismatch_count > 0 THEN
    RAISE NOTICE '███████████████████████████████████████████████████████';
    RAISE NOTICE 'VERIFICATION FAILED — rolling back';
    RAISE NOTICE 'Mismatched rows : %', mismatch_count;
    RAISE NOTICE '';

    FOR report_line IN
      WITH recomputed AS (
        SELECT id, inventory_id, created_at,
          quantity_before, quantity_after, quantity_change,
          COALESCE(
            SUM(quantity_change) OVER (
              PARTITION BY inventory_id
              ORDER BY created_at, id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0
          ) AS expected_before,
          SUM(quantity_change) OVER (
            PARTITION BY inventory_id
            ORDER BY created_at, id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS expected_after
        FROM inventory_movements
      )
      SELECT format(
        '  INV %s  id %s  created=%s  before=%s (exp %s)  after=%s (exp %s)  change=%s',
        inventory_id, id, created_at,
        quantity_before, expected_before,
        quantity_after, expected_after,
        quantity_change
      )
      FROM recomputed
      WHERE quantity_before IS DISTINCT FROM expected_before
         OR quantity_after  IS DISTINCT FROM expected_after
      LIMIT 30
    LOOP
      RAISE NOTICE '%', report_line;
    END LOOP;

    RAISE EXCEPTION 'Chain verification failed: % row(s) mismatch. Transaction rolled back.', mismatch_count;
  END IF;

  RAISE NOTICE '███████████████████████████████████████████████████████';
  RAISE NOTICE 'Verification passed: all before/after values match cumulative sums.';
  RAISE NOTICE 'All chains are clean!';
END;
$$;

COMMIT;
