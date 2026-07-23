-- 010_add_kot_cleanup_cron.sql
-- Deletes kitchen_order_tickets (and their kot_items) older than 1 day.
-- Deletes kot_items explicitly first (FK cascade may not exist in target DB).
-- Includes a one-time cleanup of pre-existing orphan kot_items and old tickets.
-- Runs daily at midnight.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ═══ 1. One-time: purge orphan kot_items (no matching KOT) ═══
DELETE FROM kot_items
WHERE kot_id NOT IN (SELECT id FROM kitchen_order_tickets);

-- ═══ 2. One-time: purge old tickets ═══
DELETE FROM kot_items
WHERE kot_id IN (
  SELECT id FROM kitchen_order_tickets
  WHERE created_at < (now() - INTERVAL '1 day')
);

DELETE FROM kitchen_order_tickets
WHERE created_at < (now() - INTERVAL '1 day');

-- ═══ 3. Create the recurring cleanup function ═══
CREATE OR REPLACE FUNCTION cron_kot_cleanup()
RETURNS text AS $$
DECLARE
  item_count     integer;
  ticket_count   integer;
BEGIN
  DELETE FROM kot_items
  WHERE kot_id IN (
    SELECT id FROM kitchen_order_tickets
    WHERE created_at < (now() - INTERVAL '1 day')
  );
  GET DIAGNOSTICS item_count = ROW_COUNT;

  DELETE FROM kitchen_order_tickets
  WHERE created_at < (now() - INTERVAL '1 day');
  GET DIAGNOSTICS ticket_count = ROW_COUNT;

  RETURN format(
    'KOT cleanup complete: %s item(s), %s ticket(s) deleted at %s',
    item_count, ticket_count, now()
  );
END;
$$ LANGUAGE plpgsql;

-- ═══ 4. Schedule to run daily at midnight ═══
DO $$
BEGIN
  PERFORM cron.unschedule('kot-cleanup');
EXCEPTION WHEN OTHERS THEN
  -- job may not exist yet — safe to ignore
END;
$$;

SELECT cron.schedule(
  'kot-cleanup',
  '0 0 * * *',
  'SELECT cron_kot_cleanup();'
);

-- ═══ Verify ═══
SELECT jobid, schedule, command, nodename, nodeport
FROM cron.job
WHERE jobname = 'kot-cleanup';
