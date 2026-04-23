# UUID Primary Key Migration — Backend Change Guide

## Summary

**Why:** POS Tempest is an offline-first app using PowerSync for local-first sync across multiple tablets. Each device was generating new primary keys using `MAX(id)+1` (or equivalent identity sequences expected client-side). With multiple devices writing concurrently and syncing later, integer IDs collide, causing data loss or conflicts on merge.

**Solution:** Migrate the 9 high-write tables to UUID primary keys. Devices now generate IDs client-side using `Crypto.randomUUID()`, which is collision-safe by construction. Tables that are centrally managed (roles, users, menu items, branches, etc.) remain INTEGER because they are only written by the backend or Supabase Studio — no offline creation risk.

**Date applied:** migration `002_uuid_primary_keys.sql`

**Tables staying INTEGER (backend/Studio-managed):**  
`roles`, `users`, `branches`, `customers`, `reservations`, `floor_areas`, `tables`, `categories`, `menu_items`, `modifier_groups`, `modifiers`, `menu_item_modifier_groups`, `menu_item_ingredients`, `inventories`, `suppliers`, `purchases`, `purchase_items`, `discounts`, `tax_configs`

---

## Type Changes Table

| Table | Column | Old Type | New Type | Notes |
|---|---|---|---|---|
| `shifts` | `id` | `integer` (identity) | `uuid` | PK |
| `kitchen_order_tickets` | `id` | `integer` (identity) | `uuid` | PK |
| `order_items` | `id` | `integer` (identity) | `uuid` | PK |
| `kot_items` | `id` | `integer` (identity) | `uuid` | PK |
| `kot_items` | `kot_id` | `integer` | `uuid` | FK → `kitchen_order_tickets.id` |
| `kot_items` | `order_item_id` | `integer` | `uuid` | FK → `order_items.id` |
| `order_item_modifiers` | `id` | `integer` (identity) | `uuid` | PK |
| `order_item_modifiers` | `order_item_id` | `integer` | `uuid` | FK → `order_items.id` |
| `payments` | `id` | `integer` (identity) | `uuid` | PK |
| `payments` | `shift_id` | `integer` | `uuid` | FK → `shifts.id`, nullable |
| `order_discounts` | `id` | `integer` (identity) | `uuid` | PK |
| `shift_cash_transactions` | `id` | `integer` (identity) | `uuid` | PK |
| `shift_cash_transactions` | `shift_id` | `integer` | `uuid` | FK → `shifts.id`, NOT NULL |
| `inventory_movements` | `id` | `integer` (identity) | `uuid` | PK |
| `orders` | `shift_id` | `integer` | `uuid` | FK → `shifts.id`, nullable — `orders.id` was already uuid |

---

## Go Struct / Model Changes

Each struct field carrying an `id`, `shift_id`, `kot_id`, or `order_item_id` for a migrated table must change from `int64`/`uint`/`int` to `uuid.UUID` (using `github.com/google/uuid`) or `string` if your codebase uses string-typed UUIDs.

### `internal/models/shift.go`
```go
// Before
type Shift struct {
    ID     int64  `db:"id"    json:"id"`
    UserID int    `db:"user_id" json:"user_id"`
    // ...
}

// After
type Shift struct {
    ID     uuid.UUID `db:"id"    json:"id"`
    UserID int       `db:"user_id" json:"user_id"`
    // ...
}
```

### `internal/models/shift_cash_transaction.go`
```go
// Before
type ShiftCashTransaction struct {
    ID      int64 `db:"id"       json:"id"`
    ShiftID int64 `db:"shift_id" json:"shift_id"`
    // ...
}

// After
type ShiftCashTransaction struct {
    ID      uuid.UUID `db:"id"       json:"id"`
    ShiftID uuid.UUID `db:"shift_id" json:"shift_id"`
    // ...
}
```

### `internal/models/order.go`
```go
// Before
type Order struct {
    ID      uuid.UUID `db:"id"       json:"id"` // already uuid — unchanged
    ShiftID *int64    `db:"shift_id" json:"shift_id"` // nullable
    // ...
}

// After
type Order struct {
    ID      uuid.UUID  `db:"id"       json:"id"`
    ShiftID *uuid.UUID `db:"shift_id" json:"shift_id"` // nullable → *uuid.UUID
    // ...
}
```

### `internal/models/order_item.go`
```go
// Before
type OrderItem struct {
    ID      int64     `db:"id"       json:"id"`
    OrderID uuid.UUID `db:"order_id" json:"order_id"` // already uuid
    // ...
}

// After
type OrderItem struct {
    ID      uuid.UUID `db:"id"       json:"id"`
    OrderID uuid.UUID `db:"order_id" json:"order_id"`
    // ...
}
```

### `internal/models/order_item_modifier.go`
```go
// Before
type OrderItemModifier struct {
    ID          int64 `db:"id"            json:"id"`
    OrderItemID int64 `db:"order_item_id" json:"order_item_id"`
    // ...
}

// After
type OrderItemModifier struct {
    ID          uuid.UUID `db:"id"            json:"id"`
    OrderItemID uuid.UUID `db:"order_item_id" json:"order_item_id"`
    // ...
}
```

### `internal/models/kitchen_order_ticket.go`
```go
// Before
type KitchenOrderTicket struct {
    ID      int64     `db:"id"       json:"id"`
    OrderID uuid.UUID `db:"order_id" json:"order_id"` // already uuid
    // ...
}

// After
type KitchenOrderTicket struct {
    ID      uuid.UUID `db:"id"       json:"id"`
    OrderID uuid.UUID `db:"order_id" json:"order_id"`
    // ...
}
```

### `internal/models/kot_item.go`
```go
// Before
type KotItem struct {
    ID          int64 `db:"id"            json:"id"`
    KotID       int64 `db:"kot_id"        json:"kot_id"`
    OrderItemID int64 `db:"order_item_id" json:"order_item_id"`
    // ...
}

// After
type KotItem struct {
    ID          uuid.UUID `db:"id"            json:"id"`
    KotID       uuid.UUID `db:"kot_id"        json:"kot_id"`
    OrderItemID uuid.UUID `db:"order_item_id" json:"order_item_id"`
    // ...
}
```

### `internal/models/payment.go`
```go
// Before
type Payment struct {
    ID      int64      `db:"id"       json:"id"`
    OrderID uuid.UUID  `db:"order_id" json:"order_id"` // already uuid
    ShiftID *int64     `db:"shift_id" json:"shift_id"` // nullable
    // ...
}

// After
type Payment struct {
    ID      uuid.UUID  `db:"id"       json:"id"`
    OrderID uuid.UUID  `db:"order_id" json:"order_id"`
    ShiftID *uuid.UUID `db:"shift_id" json:"shift_id"` // nullable → *uuid.UUID
    // ...
}
```

### `internal/models/order_discount.go`
```go
// Before
type OrderDiscount struct {
    ID      int64     `db:"id"       json:"id"`
    OrderID uuid.UUID `db:"order_id" json:"order_id"` // already uuid
    // ...
}

// After
type OrderDiscount struct {
    ID      uuid.UUID `db:"id"       json:"id"`
    OrderID uuid.UUID `db:"order_id" json:"order_id"`
    // ...
}
```

### `internal/models/inventory_movement.go`
```go
// Before
type InventoryMovement struct {
    ID int64 `db:"id" json:"id"`
    // ...
}

// After
type InventoryMovement struct {
    ID uuid.UUID `db:"id" json:"id"`
    // ...
}
```

---

## Repository / SQL Query Changes

### Parameter binding for WHERE clauses

Any repository query filtering by `id` on a migrated table must accept `uuid.UUID`:

```go
// Before (internal/repository/shift_repo.go)
func (r *ShiftRepo) GetByID(ctx context.Context, id int64) (*models.Shift, error) {
    err := r.db.GetContext(ctx, &shift, `SELECT * FROM shifts WHERE id = $1`, id)
    // ...
}

// After
func (r *ShiftRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Shift, error) {
    err := r.db.GetContext(ctx, &shift, `SELECT * FROM shifts WHERE id = $1`, id)
    // ...
}
```

The same applies to `GetByID` and `DeleteByID` methods on:  
`ShiftRepo`, `KitchenOrderTicketRepo`, `OrderItemRepo`, `KotItemRepo`,  
`OrderItemModifierRepo`, `PaymentRepo`, `OrderDiscountRepo`,  
`ShiftCashTransactionRepo`, `InventoryMovementRepo`

### INSERT — client-supplied UUIDs

For migrated tables, the mobile client generates the UUID before sending. INSERTs should accept and insert the client-supplied ID rather than relying on `RETURNING id` from a server-side sequence:

```go
// Before — server generates id
func (r *ShiftRepo) Create(ctx context.Context, s *models.Shift) error {
    return r.db.QueryRowContext(ctx,
        `INSERT INTO shifts (user_id, branch_id, ...) VALUES ($1, $2, ...) RETURNING id`,
        s.UserID, s.BranchID, ...,
    ).Scan(&s.ID)
}

// After — client supplies id; no RETURNING needed (or use RETURNING to confirm)
func (r *ShiftRepo) Create(ctx context.Context, s *models.Shift) error {
    if s.ID == uuid.Nil {
        s.ID = uuid.New() // fallback for server-originated creates
    }
    _, err := r.db.ExecContext(ctx,
        `INSERT INTO shifts (id, user_id, branch_id, ...) VALUES ($1, $2, $3, ...)`,
        s.ID, s.UserID, s.BranchID, ...,
    )
    return err
}
```

Prefer upsert (`INSERT ... ON CONFLICT (id) DO UPDATE ...`) if there is any chance of PowerSync replay delivering the same row twice.

### FK join queries

Any JOIN or sub-query that joins on migrated FK columns will continue to work syntactically — only the Go binding type changes. Ensure query parameters passed to e.g. `WHERE shift_id = $1` are `uuid.UUID`, not `int64`.

---

## API / DTO Changes

### JSON field types

All `id` fields for migrated entities now serialize as UUID strings (`"3f2504e0-4f89-11d3-9a0c-0305e82c3301"`) instead of integers. Update request/response types in your DTO layer accordingly:

```go
// internal/dto/shift_dto.go

// Before
type ShiftResponse struct {
    ID     int64  `json:"id"`
    // ...
}
type CreateShiftRequest struct {
    // id absent — server generated
}

// After
type ShiftResponse struct {
    ID     string `json:"id"`   // uuid as string; or uuid.UUID with custom marshalling
    // ...
}
type CreateShiftRequest struct {
    ID string `json:"id"` // client MUST supply a UUID v4
    // ...
}
```

Apply the same pattern to:  
`ShiftCashTransactionRequest/Response`, `OrderItemRequest/Response`,  
`OrderItemModifierRequest/Response`, `KitchenOrderTicketRequest/Response`,  
`KotItemRequest/Response`, `PaymentRequest/Response`,  
`OrderDiscountRequest/Response`, `InventoryMovementRequest/Response`

Also update any `order.shift_id` field in order DTOs from `*int64` to `*string`.

### API version note

This is a **breaking change** for any API client that:
- Stores or compares entity IDs as integers
- Builds integer-based pagination with e.g. `WHERE id > $last_seen`

**Recommendation:** Bump the API version (e.g., `v2`) for affected endpoints, or negotiate via `Accept` header. Ensure the mobile app and any partner integrations are updated in lock-step with the backend deployment.

---

## PowerSync Sync Rules

The PowerSync sync rules YAML (typically `sync-rules.yaml` or configured in the PowerSync dashboard) may filter rows using bucket parameters.

Key points:
- `shifts.device_id` is already `uuid` — no change needed for device-scoped buckets.
- If any sync rule filters by `shifts.id`, `order_items.id`, `payments.id`, `kitchen_order_tickets.id`, etc., those parameters are now strings/UUIDs. PowerSync bucket parameters are typically strings so this should be transparent, but **verify** any rule that casts these IDs to integers.
- Sync rules using `WHERE shift_id = bucket.shift_id` will continue to work as long as both sides are compared as text/uuid.

Example: if you have a rule like:
```yaml
bucket_parameters:
  - name: shift_id
    type: text   # was: type: integer — update if typed
```
Change any `type: integer` to `type: text` for bucket parameters that now carry a UUID.

---

## Migration Runbook

### Pre-migration checklist
- [ ] Announce maintenance window (this migration acquires brief table locks per step)
- [ ] Take a full Postgres snapshot / database backup
- [ ] Verify backup restoration works in a staging environment
- [ ] Run the migration on staging first and validate row counts

### Steps

```bash
# 1. Backup
pg_dump -Fc -n pos_tempest -h <host> -U <user> <dbname> \
  -f pos_tempest_pre_002_$(date +%Y%m%d_%H%M%S).dump

# 2. Apply migration
psql -h <host> -U <user> <dbname> \
  -f scripts/migrations/002_uuid_primary_keys.sql

# 3. Verify row counts (spot-check)
psql -h <host> -U <user> <dbname> -c "
  SET search_path TO pos_tempest;
  SELECT 'shifts'                 , count(*) FROM shifts
  UNION ALL
  SELECT 'kitchen_order_tickets'  , count(*) FROM kitchen_order_tickets
  UNION ALL
  SELECT 'order_items'            , count(*) FROM order_items
  UNION ALL
  SELECT 'kot_items'              , count(*) FROM kot_items
  UNION ALL
  SELECT 'order_item_modifiers'   , count(*) FROM order_item_modifiers
  UNION ALL
  SELECT 'payments'               , count(*) FROM payments
  UNION ALL
  SELECT 'order_discounts'        , count(*) FROM order_discounts
  UNION ALL
  SELECT 'shift_cash_transactions', count(*) FROM shift_cash_transactions
  UNION ALL
  SELECT 'inventory_movements'    , count(*) FROM inventory_movements;
"

# 4. Verify id column types
psql -h <host> -U <user> <dbname> -c "
  SET search_path TO pos_tempest;
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'pos_tempest'
    AND column_name = 'id'
    AND table_name IN (
      'shifts','kitchen_order_tickets','order_items','kot_items',
      'order_item_modifiers','payments','order_discounts',
      'shift_cash_transactions','inventory_movements'
    )
  ORDER BY table_name;
"
-- All rows should show data_type = 'uuid'

# 5. Deploy updated backend (new Go structs, UUIDs in DTOs)
# 6. Deploy updated mobile app (schema.ts + UUID generation)
# 7. Monitor PowerSync sync queue for upload errors
```

### Expected locking behaviour

Each `ALTER TABLE ... DROP COLUMN` and `RENAME COLUMN` acquires an `AccessExclusiveLock` on its table for the duration of that statement. On busy production tables with large row counts, this may block reads/writes for seconds. Prefer running during off-peak hours or during a maintenance window.

---

## Rollback Strategy

> **This is a one-way migration.** There is no `002_rollback.sql` included.

The migration is designed to be applied once. Rolling back requires:

1. Restoring the pre-migration database snapshot taken in step 1 of the runbook.
2. Redeploying the previous backend version.
3. Redeploying the previous mobile app.

**Strongly recommend** taking the Postgres snapshot/dump _before_ applying the migration and keeping it for at least 7 days. If using Supabase, use the point-in-time restore feature (available on Pro+) and note the timestamp before applying the migration.

A dedicated `002_rollback.sql` could be written (re-adding integer columns, backfilling from UUID → deterministic integer, swapping back), but the round-trip is lossy because UUIDs generated after migration have no canonical integer equivalent. **Do not attempt a manual rollback without a snapshot.**

---

## Mobile-Side Follow-Up (Informational)

The following mobile changes are required in a separate task. They are listed here for awareness:

### `db/schema.ts` — PowerSync column type changes

| Table | Column | Current | Required |
|---|---|---|---|
| `shifts` | *(id — managed by PowerSync)* | — | — |
| `orders` | `shift_id` | `column.integer` | `column.text` |
| `payments` | `shift_id` | `column.integer` | `column.text` |
| `shift_cash_transactions` | `shift_id` | `column.integer` | `column.text` |
| `order_item_modifiers` | `order_item_id` | `column.integer` | `column.text` |
| `kot_items` | `kot_id` | `column.integer` | `column.text` |
| `kot_items` | `order_item_id` | `column.integer` | `column.text` |

> Note: PowerSync represents all primary keys as `text` internally. The schema.ts change is only needed for non-PK FK columns that reference migrated tables.

### Services — replace `MAX(id)+1` with `Crypto.randomUUID()`

Any service or hook that currently generates IDs for migrated tables via integer arithmetic must switch to:

```typescript
import * as Crypto from 'expo-crypto';

const id = Crypto.randomUUID(); // RFC 4122 v4 UUID
```

Affected services (approximate paths):
- `services/shift.service.ts` — `openShift()` create
- `services/order-item.service.ts` — `addOrderItem()` create
- `services/kitchen.service.ts` — `createKOT()`, `addKotItem()` creates
- `services/payment.service.ts` — `createPayment()` create
- `services/order-discount.service.ts` — `applyDiscount()` create
- `services/shift-cash.service.ts` — `recordCashTransaction()` create
- `services/inventory.service.ts` — `recordMovement()` create

### `db/connector.ts` — no changes required

The existing connector already handles all tables with `upsert(..., { onConflict: 'id' })` using `op.id` as a string, which is UUID-compatible. The special-case handling for `shifts` (skipping null `device_id`) remains valid and unchanged.
