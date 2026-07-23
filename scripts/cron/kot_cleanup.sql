-- kot_cleanup.sql
-- Deletes kitchen order tickets older than 1 day.
-- kot_items cascade-delete automatically via FK ON DELETE CASCADE.
-- Designed to run daily at midnight via pg_cron.
--
-- Usage:
--   1. Run this file in Supabase SQL Editor to create the function + schedule
--   2. Requires pg_cron extension enabled (Dashboard → Extensions)

-- ═══ Ensure pg_cron is available ═══
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ═══ 1. Create the cleanup function ═══
CREATE OR REPLACE FUNCTION cron_kot_cleanup()
RETURNS text AS $$
DECLARE
  deleted_count  integer;
BEGIN
  DELETE FROM kitchen_order_tickets
  WHERE created_at < (now() - INTERVAL '1 day');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN format(
    'KOT cleanup complete: %s ticket(s) deleted at %s',
    deleted_count, now()
  );
END;
$$ LANGUAGE plpgsql;

-- ═══ 2. Schedule to run daily at midnight ═══
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
