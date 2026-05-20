-- 005_add_gaji_pengeluaran_pribadi.sql
-- Adds new cash transaction reason enum values 'gaji' (Staff Advance → Gaji)
-- and 'pengeluaran_pribadi' (Owner Withdrawal → Pengeluaran Pribadi),
-- then migrates existing rows from the legacy values.
-- Intentionally not wrapped in BEGIN/COMMIT: PostgreSQL enum values added in
-- a transaction cannot be used until that transaction commits.

SET search_path TO pos_tempest;

ALTER TYPE cash_transaction_reason ADD VALUE IF NOT EXISTS 'gaji';
ALTER TYPE cash_transaction_reason ADD VALUE IF NOT EXISTS 'pengeluaran_pribadi';

-- Migrate historical data
UPDATE shift_cash_transactions SET reason = 'gaji' WHERE reason = 'staff_advance';
UPDATE shift_cash_transactions SET reason = 'pengeluaran_pribadi' WHERE reason = 'owner_withdrawal';
