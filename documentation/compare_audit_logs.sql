-- Compare audit_logs column names and types between schemas
SELECT
  COALESCE(dev.column_name, prod.column_name) AS column_name,
  dev.data_type                                AS dev_type,
  prod.data_type                               AS prod_type,
  dev.data_type = prod.data_type               AS types_match
FROM (
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'pos_tempest'
    AND table_name   = 'audit_logs'
) dev
FULL OUTER JOIN (
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'pos_tempest_prod'
    AND table_name   = 'audit_logs'
) prod USING (column_name)
ORDER BY column_name;
