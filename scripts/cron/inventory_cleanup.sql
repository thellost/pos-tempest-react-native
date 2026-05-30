-- inventory_cleanup.sql
-- Lightweight periodic maintenance: deletes accidental duplicate movement
-- rows and syncs any inventories that drift from their movement ledger.
-- Designed to run on a schedule via pg_cron (no chain rebuild — that's a
-- one-time fix handled by migration 009).
--
-- Usage:
--   1. Run this file in Supabase SQL Editor to create the function + schedule
--   2. Requires pg_cron extension enabled (Dashboard → Extensions)
--   3. Schedule: every 15 minutes. Adjust to your needs in step 2.

-- ═══ Ensure pg_cron is available ═══
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ═══ 1. Create the cleanup function ═══
CREATE OR REPLACE FUNCTION cron_inventory_cleanup()
RETURNS text AS $$
DECLARE
  deleted_count  integer;
  synced_count   integer;
BEGIN
  -- 1a. Delete accidental duplicate movement rows
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

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 1b. Recompute stock for any inventory that drifted from its ledger
  WITH drifted AS (
    UPDATE inventories i
    SET
      stock_quantity = sub.ledger_sum,
      updated_at     = now()
    FROM (
      SELECT inventory_id, SUM(quantity_change) AS ledger_sum
      FROM inventory_movements
      GROUP BY inventory_id
    ) sub
    WHERE i.id = sub.inventory_id
      AND i.stock_quantity IS DISTINCT FROM sub.ledger_sum
    RETURNING i.id
  )
  SELECT COUNT(*) INTO synced_count FROM drifted;

  RETURN format(
    'Cleanup complete: %s duplicate(s) deleted, %s stock(s) synced at %s',
    deleted_count, synced_count, now()
  );
END;
$$ LANGUAGE plpgsql;

-- ═══ 2. Schedule to run every 15 minutes ═══
DO $$
BEGIN
  PERFORM cron.unschedule('inventory-cleanup');
EXCEPTION WHEN OTHERS THEN
  -- job may not exist yet — safe to ignore
END;
$$;

SELECT cron.schedule(
  'inventory-cleanup',
  '*/15 * * * *',
  'SELECT cron_inventory_cleanup();'
);

-- ═══ Verify ═══
SELECT jobid, schedule, command, nodename, nodeport
FROM cron.job
WHERE jobname = 'inventory-cleanup';
