-- 006_add_branch_id_to_menu.sql
-- Adds branch_id to categories and menu_items tables so each branch
-- can have its own independent menu (categories + items).
-- Existing rows are assigned to branch 1.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id INTEGER;
UPDATE categories SET branch_id = 1 WHERE branch_id IS NULL;
ALTER TABLE categories ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE categories ADD FOREIGN KEY (branch_id) REFERENCES branches(id);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS branch_id INTEGER;
UPDATE menu_items SET branch_id = 1 WHERE branch_id IS NULL;
ALTER TABLE menu_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE menu_items ADD FOREIGN KEY (branch_id) REFERENCES branches(id);

DROP INDEX IF EXISTS idx_categories_parent_sort;
CREATE INDEX idx_categories_branch_parent_sort ON categories (branch_id, parent_id, sort_order);

DROP INDEX IF EXISTS idx_menu_items_sort;
DROP INDEX IF EXISTS idx_menu_items_category;
CREATE INDEX idx_menu_items_branch_sort ON menu_items (branch_id, sort_order);
CREATE INDEX idx_menu_items_branch_category ON menu_items (branch_id, category_id);

DROP INDEX IF EXISTS menu_items_sku_key;
CREATE UNIQUE INDEX idx_menu_items_branch_sku ON menu_items (branch_id, sku);
