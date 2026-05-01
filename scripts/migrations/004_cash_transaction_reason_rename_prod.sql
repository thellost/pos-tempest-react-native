-- 004_cash_transaction_reason_rename_prod.sql
-- Adds the renamed cash transaction reason enum values and migrates existing
-- stored rows from the legacy cash-out reason values.
-- Intentionally not wrapped in BEGIN/COMMIT: PostgreSQL enum values added in
-- a transaction cannot be used until that transaction commits.

SET search_path TO pos_tempest_prod;

ALTER TYPE cash_transaction_reason ADD VALUE IF NOT EXISTS 'angsuran';
ALTER TYPE cash_transaction_reason ADD VALUE IF NOT EXISTS 'operasional';
