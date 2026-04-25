# POS Tempest CMS — API Reference

> **Base URL:** `http://localhost:8080`
> **Content-Type:** `application/json`
> **Total Endpoints:** 97

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Response Format](#2-response-format)
3. [Pagination](#3-pagination)
4. [Error Codes](#4-error-codes)
5. [Health Check](#5-health-check)
6. [Branches](#6-branches)
7. [Users](#7-users)
8. [Devices](#8-devices)
9. [Shifts](#9-shifts)
10. [Floor Areas](#10-floor-areas)
11. [Tables](#11-tables)
12. [Categories](#12-categories)
13. [Menu Items](#13-menu-items)
14. [Modifier Groups](#14-modifier-groups)
15. [Modifiers](#15-modifiers)
16. [Menu ↔ Modifier Links](#16-menu--modifier-links)
17. [Customers](#17-customers)
18. [Reservations](#18-reservations)
19. [Orders (Read-Only)](#19-orders-read-only)
20. [Discounts](#20-discounts)
21. [Inventory](#21-inventory)
22. [Suppliers](#22-suppliers)
23. [Purchases](#23-purchases)
24. [Audit Logs (Read-Only)](#24-audit-logs-read-only)
25. [Statistics](#25-statistics)
26. [Enum Reference](#26-enum-reference)

---

## 1. Authentication

All endpoints under `/api/v1/*` require a **Supabase JWT** in the `Authorization` header.

### How to Authenticate

1. Sign in via Supabase Auth (from your frontend) to get an access token.
2. Attach it to every API request:

```
Authorization: Bearer <supabase_access_token>
```

### Example Authenticated Request

```
GET /api/v1/branches HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE3NDA4NjQwMDB9.signature
Content-Type: application/json
```

### Role-Based Access Control (RBAC)

| Role | Access Level |
|------|-------------|
| `admin` | Full access to all endpoints |
| `manager` | All management endpoints (no branch create/delete, no user deactivation) |
| `cashier` | Near-manager access: all management endpoints except stock adjustment and tax configuration |
| `chef` | Shifts, customers, reservations, own profile |
| `waiter` | Shifts, customers, reservations, own profile |

If your role does not have permission, you will receive a `403 Forbidden` response.

---

## 2. Response Format

Every response follows this JSON envelope:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": null
}
```

### Success Response with Pagination

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "branch not found"
  }
}
```

---

## 3. Pagination

All list endpoints support pagination via query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | int | 1 | — | Page number (1-based) |
| `page_size` | int | 20 | 100 | Items per page |

**Example:** `GET /api/v1/branches?page=2&page_size=10`

---

## 4. Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid input or malformed request body |
| 401 | `UNAUTHORIZED` | Missing, expired, or invalid JWT token |
| 403 | `FORBIDDEN` | Valid token but insufficient role permissions |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate entry (e.g. unique constraint violation) |
| 422 | `VALIDATION_ERROR` | Field-level validation failure |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## 5. Health Check

### `GET /health`

> No authentication required.

**Response `200 OK`:**
```json
{
  "status": "ok"
}
```

---

## 6. Branches

### `GET /api/v1/branches`

> **Roles:** admin, manager, cashier

List all branches with pagination.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Tempest Cafe - Sudirman",
      "address": "Jl. Sudirman No. 123, Jakarta Pusat",
      "phone": "021-5551234",
      "tax_rate": 11.00,
      "service_charge_rate": 5.00,
      "currency": "IDR",
      "timezone": "Asia/Jakarta",
      "is_active": true,
      "opening_time": "08:00",
      "closing_time": "22:00",
      "auto_shift": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-02-20T10:30:00Z"
    },
    {
      "id": 2,
      "name": "Tempest Cafe - Kemang",
      "address": "Jl. Kemang Raya No. 45",
      "phone": "021-5559876",
      "tax_rate": 11.00,
      "service_charge_rate": 5.00,
      "currency": "IDR",
      "timezone": "Asia/Jakarta",
      "is_active": true,
      "opening_time": "09:00",
      "closing_time": "23:00",
      "auto_shift": true,
      "created_at": "2026-01-20T09:00:00Z",
      "updated_at": "2026-01-20T09:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/branches/:id`

> **Roles:** admin, manager, cashier

Get a single branch by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | Branch ID |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tempest Cafe - Sudirman",
    "address": "Jl. Sudirman No. 123, Jakarta Pusat",
    "phone": "021-5551234",
    "tax_rate": 11.00,
    "service_charge_rate": 5.00,
    "currency": "IDR",
    "timezone": "Asia/Jakarta",
    "is_active": true,
    "opening_time": "08:00",
    "closing_time": "22:00",
    "auto_shift": true,
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-02-20T10:30:00Z"
  }
}
```

**Response `404 Not Found`:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "branch not found"
  }
}
```

---

### `POST /api/v1/branches`

> **Roles:** admin

Create a new branch.

**Request Body:**
```json
{
  "name": "Tempest Cafe - PIK",
  "address": "Jl. Pantai Indah Kapuk No. 10",
  "phone": "021-5550000",
  "tax_rate": 11.00,
  "service_charge_rate": 5.00,
  "currency": "IDR",
  "timezone": "Asia/Jakarta",
  "opening_time": "08:00",
  "closing_time": "22:00",
  "auto_shift": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | max 100 chars |
| `address` | string | ❌ | — |
| `phone` | string | ❌ | max 20 chars |
| `tax_rate` | float | ❌ | 0–100 |
| `service_charge_rate` | float | ❌ | 0–100 |
| `currency` | string | ❌ | max 3 chars (defaults to `IDR`) |
| `timezone` | string | ❌ | defaults to `Asia/Jakarta` |
| `opening_time` | string | ❌ | HH:MM 24h (defaults to `08:00`), used by auto-shift scheduler |
| `closing_time` | string | ❌ | HH:MM 24h (defaults to `22:00`), used by auto-shift scheduler |
| `auto_shift` | bool | ❌ | defaults to `true`; when true the scheduler auto-opens/closes shifts |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Tempest Cafe - PIK",
    "address": "Jl. Pantai Indah Kapuk No. 10",
    "phone": "021-5550000",
    "tax_rate": 11.00,
    "service_charge_rate": 5.00,
    "currency": "IDR",
    "timezone": "Asia/Jakarta",
    "is_active": true,
    "opening_time": "08:00",
    "closing_time": "22:00",
    "auto_shift": true,
    "created_at": "2026-03-03T14:00:00Z",
    "updated_at": "2026-03-03T14:00:00Z"
  }
}
```

---

### `PUT /api/v1/branches/:id`

> **Roles:** admin

Update a branch. Only send fields you want to change.

**Request Body:**
```json
{
  "name": "Tempest Cafe - Sudirman (Renovated)",
  "tax_rate": 12.00
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ❌ | max 100 chars |
| `address` | string | ❌ | — |
| `phone` | string | ❌ | max 20 chars |
| `tax_rate` | float | ❌ | 0–100 |
| `service_charge_rate` | float | ❌ | 0–100 |
| `currency` | string | ❌ | max 3 chars |
| `timezone` | string | ❌ | — |
| `is_active` | bool | ❌ | — |
| `opening_time` | string | ❌ | HH:MM 24h |
| `closing_time` | string | ❌ | HH:MM 24h |
| `auto_shift` | bool | ❌ | enable/disable scheduler for this branch |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tempest Cafe - Sudirman (Renovated)",
    "address": "Jl. Sudirman No. 123, Jakarta Pusat",
    "phone": "021-5551234",
    "tax_rate": 12.00,
    "service_charge_rate": 5.00,
    "currency": "IDR",
    "timezone": "Asia/Jakarta",
    "is_active": true,
    "opening_time": "08:00",
    "closing_time": "22:00",
    "auto_shift": true,
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-03-03T14:30:00Z"
  }
}
```

---

### `DELETE /api/v1/branches/:id`

> **Roles:** admin

Soft-delete (deactivate) a branch. Sets `is_active = false`.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "branch deleted successfully"
  }
}
```

---

## 7. Users

### `GET /api/v1/users`

> **Roles:** admin, manager, cashier

List users with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `role_id` | int | Filter by role |
| `is_active` | bool | Filter by active status |
| `search` | string | Search name or email |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Example:** `GET /api/v1/users?branch_id=1&role_id=3&search=john`

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "supabase_auth_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "role_id": 1,
      "branch_id": 1,
      "name": "John Admin",
      "email": "john@tempest.com",
      "phone": "081234567890",
      "avatar_url": null,
      "is_active": true,
      "last_login_at": "2026-03-03T08:15:00Z",
      "retry_attempts": 0,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-03-03T08:15:00Z",
      "role_name": "admin",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/users/:id`

> **Roles:** admin, manager, cashier

Get a single user by ID.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "supabase_auth_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "role_id": 3,
    "branch_id": 1,
    "name": "Sarah Cashier",
    "email": "sarah@tempest.com",
    "phone": "081298765432",
    "avatar_url": null,
    "is_active": true,
    "last_login_at": "2026-03-02T14:00:00Z",
    "retry_attempts": 0,
    "created_at": "2026-02-01T10:00:00Z",
    "updated_at": "2026-03-02T14:00:00Z",
    "role_name": "cashier",
    "branch_name": "Tempest Cafe - Sudirman"
  }
}
```

---

### `GET /api/v1/users/me`

> **Roles:** all staff

Get the currently authenticated user's own profile.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "supabase_auth_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "role_id": 3,
    "branch_id": 1,
    "name": "Sarah Cashier",
    "email": "sarah@tempest.com",
    "phone": "081298765432",
    "avatar_url": null,
    "is_active": true,
    "last_login_at": "2026-03-02T14:00:00Z",
    "retry_attempts": 0,
    "created_at": "2026-02-01T10:00:00Z",
    "updated_at": "2026-03-02T14:00:00Z",
    "role_name": "cashier",
    "branch_name": "Tempest Cafe - Sudirman"
  }
}
```

---

### `POST /api/v1/users`

> **Roles:** admin, manager, cashier

Create a new user. This creates the user in **Supabase Auth** and in the **database**.

**Request Body:**
```json
{
  "email": "newstaff@tempest.com",
  "password": "securepass123",
  "name": "New Staff Member",
  "role_id": 3,
  "branch_id": 1,
  "phone": "081200001111",
  "pin_code": "1234"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ | valid email, max 255 chars |
| `password` | string | ✅ | min 8 chars |
| `name` | string | ✅ | max 100 chars |
| `role_id` | int | ✅ | must exist in roles table |
| `branch_id` | int | ✅ | must exist in branches table |
| `phone` | string | ❌ | max 20 chars |
| `pin_code` | string | ❌ | 4–8 chars (hashed before storage) |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "supabase_auth_id": "d4e5f6a7-b8c9-0123-defg-456789012345",
    "role_id": 3,
    "branch_id": 1,
    "name": "New Staff Member",
    "email": "newstaff@tempest.com",
    "phone": "081200001111",
    "avatar_url": null,
    "is_active": true,
    "last_login_at": null,
    "retry_attempts": 0,
    "created_at": "2026-03-03T15:00:00Z",
    "updated_at": "2026-03-03T15:00:00Z",
    "role_name": "cashier",
    "branch_name": "Tempest Cafe - Sudirman"
  }
}
```

---

### `PUT /api/v1/users/:id`

> **Roles:** admin, manager, cashier

Update a user. Only send fields you want to change.

**Request Body:**
```json
{
  "name": "Sarah Senior Cashier",
  "role_id": 2,
  "phone": "081299999999"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ❌ | max 100 chars |
| `phone` | string | ❌ | max 20 chars |
| `pin_code` | string | ❌ | 4–8 chars |
| `avatar_url` | string | ❌ | max 500 chars |
| `is_active` | bool | ❌ | — |
| `role_id` | int | ❌ | — |
| `branch_id` | int | ❌ | — |

**Response `200 OK`:** Returns the updated user object (same shape as GET).

---

### `PATCH /api/v1/users/:id/deactivate`

> **Roles:** admin

Deactivate a user. Sets `is_active = false`.

**Request Body:** None required.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "user deactivated successfully"
  }
}
```

---

## 8. Devices

### `GET /api/v1/devices`

> **Roles:** admin, manager, cashier

List devices, optionally filtered by branch.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "device_uid": "550e8400-e29b-41d4-a716-446655440000",
      "branch_id": 1,
      "device_name": "Kasir 1",
      "status": "active",
      "registered_at": "2026-01-20T09:00:00Z",
      "last_seen_at": "2026-03-03T14:30:00Z",
      "branch_name": "Tempest Cafe - Sudirman"
    },
    {
      "device_uid": "660e8400-e29b-41d4-a716-446655440001",
      "branch_id": 1,
      "device_name": "Bar Terminal",
      "status": "active",
      "registered_at": "2026-01-25T10:00:00Z",
      "last_seen_at": "2026-03-03T12:00:00Z",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### `POST /api/v1/devices`

> **Roles:** admin, manager, cashier

Register a new device.

**Request Body:**
```json
{
  "branch_id": 1,
  "device_uid": "770e8400-e29b-41d4-a716-446655440002",
  "device_name": "Kasir 2"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `branch_id` | int | ✅ | must exist |
| `device_uid` | string (UUID) | ✅ | valid UUID v4, must be unique |
| `device_name` | string | ✅ | max 100 chars |

**Response `201 Created`:** Returns the created device object.

---

### `PUT /api/v1/devices/:device_uid`

> **Roles:** admin, manager, cashier

Update device name or status. `:device_uid` is the UUID primary key of the device.

**Request Body:**
```json
{
  "device_name": "Kasir Utama"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `device_name` | string | ❌ | max 100 chars |
| `status` | string | ❌ | `active` or `inactive` |

**Response `200 OK`:** Returns the updated device object.

---

### `PATCH /api/v1/devices/:device_uid/status`

> **Roles:** admin, manager, cashier

Change device status only. `:device_uid` is the UUID primary key of the device.

**Request Body:**
```json
{
  "status": "inactive"
}
```

**Response `200 OK`:** Returns the updated device object.

---

## 9. Shifts

### `GET /api/v1/shifts`

> **Roles:** all staff

List shifts with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `device_id` | string (UUID) | Filter by device |
| `user_id` | int | Filter by user who opened |
| `status` | string | `open` or `closed` |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
      "user_id": 2,
      "device_id": "550e8400-e29b-41d4-a716-446655440000",
      "branch_id": 1,
      "status": "closed",
      "opening_cash": 500000.00,
      "closing_cash": 1850000.00,
      "expected_cash": 1830000.00,
      "cash_difference": 20000.00,
      "opened_at": "2026-03-03T07:00:00Z",
      "closed_at": "2026-03-03T15:00:00Z",
      "notes": "Everything balanced",
      "user_name": "Sarah Cashier",
      "device_name": "Kasir 1",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/shifts/:id`

> **Roles:** all staff

Get a single shift by ID.

**Response `200 OK`:** Returns the shift object (same shape as list item).

---

### `GET /api/v1/shifts/:id/summary`

> **Roles:** all staff

Get the financial summary for a shift.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
    "total_orders": 45,
    "total_revenue": 6750000.00,
    "total_discount": 250000.00,
    "total_tax": 742500.00,
    "total_service": 337500.00,
    "net_revenue": 5420000.00,
    "opening_cash": 500000.00,
    "closing_cash": 1850000.00,
    "expected_cash": 1830000.00,
    "cash_difference": 20000.00,
    "total_cash_in": 100000.00,
    "total_cash_out": 200000.00,
    "payment_breakdown": [
      {
        "payment_method": "cash",
        "count": 25,
        "total_amount": 3500000.00,
        "percentage": 51.85
      },
      {
        "payment_method": "qris",
        "count": 12,
        "total_amount": 2000000.00,
        "percentage": 29.63
      },
      {
        "payment_method": "debit_card",
        "count": 8,
        "total_amount": 1250000.00,
        "percentage": 18.52
      }
    ],
    "cash_transactions": [
      {
        "id": "a1c2e3d4-5678-49ab-9cde-0123456789ab",
        "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
        "user_id": 2,
        "type": "cash_out",
        "reason": "owner_withdrawal",
        "amount": 200000.00,
        "note": "Owner took cash for supplies",
        "created_at": "2026-03-03T10:30:00Z",
        "user_name": "Sarah Cashier"
      }
    ]
  }
}
```

---

### `POST /api/v1/shifts/open`

> **Roles:** all staff

Open a new shift on a device. The `user_id` is automatically set from the authenticated user.

**Request Body:**
```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "branch_id": 1,
  "opening_cash": 500000.00
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `device_id` | string (UUID) | ✅ | must exist, must not have an open shift |
| `branch_id` | int | ✅ | must exist |
| `opening_cash` | float | ❌ | >= 0 (defaults to 0) |

**Response `201 Created`:** Returns the created shift object.

**Error `400`:** `"device already has an open shift"` — close the existing shift first.

---

### `POST /api/v1/shifts/:id/close`

> **Roles:** all staff

Close an open shift. The server computes `expected_cash` and `cash_difference`.

**Request Body:**
```json
{
  "closing_cash": 1850000.00,
  "notes": "Everything balanced"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `closing_cash` | float | ✅ | >= 0 |
| `notes` | string | ❌ | — |

**How `cash_difference` is computed:**
```
expected_cash = opening_cash + cash_payments_received - change_given + total_cash_in - total_cash_out
cash_difference = closing_cash - expected_cash
```

Where:
- `cash_payments_received` = sum of cash payment amounts from orders
- `change_given` = sum of change amounts from cash payments
- `total_cash_in` = sum of cash_in transactions (deposits, refills)
- `total_cash_out` = sum of cash_out transactions (withdrawals, expenses)

**Response `200 OK`:** Returns the updated (closed) shift object with computed fields.

---

### `POST /api/v1/shifts/:id/cash-transactions`

> **Roles:** all staff

Record a non-order cash movement (e.g., owner withdrawal, petty cash, cash deposit) against an **open** shift. This does not affect order payments — it only tracks manual cash drawer changes for accurate cash reconciliation.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Shift ID |

**Request Body:**
```json
{
  "type": "cash_out",
  "reason": "owner_withdrawal",
  "amount": 200000.00,
  "note": "Owner took cash for supplies"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | ✅ | `cash_in` or `cash_out` |
| `reason` | string | ✅ | See [Cash Transaction Reason](#cash-transaction-reason) enum |
| `amount` | float | ✅ | > 0 |
| `note` | string | ❌ | Free-text note |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "a1c2e3d4-5678-49ab-9cde-0123456789ab",
    "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
    "user_id": 2,
    "type": "cash_out",
    "reason": "owner_withdrawal",
    "amount": 200000.00,
    "note": "Owner took cash for supplies",
    "created_at": "2026-03-03T10:30:00Z",
    "user_name": "Sarah Cashier"
  }
}
```

**Error `404`:** Shift not found.

**Error `400`:** Shift is not open (transactions cannot be added to a closed shift).

---

### `GET /api/v1/shifts/:id/cash-transactions`

> **Roles:** all staff

List all non-order cash transactions recorded against a shift, ordered chronologically. The full list is also embedded in the shift summary response under `cash_transactions`.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Shift ID |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "a1c2e3d4-5678-49ab-9cde-0123456789ab",
      "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
      "user_id": 2,
      "type": "cash_out",
      "reason": "owner_withdrawal",
      "amount": 200000.00,
      "note": "Owner took cash for supplies",
      "created_at": "2026-03-03T10:30:00Z",
      "user_name": "Sarah Cashier"
    },
    {
      "id": "b2d3f4e5-6789-4abc-8def-112233445566",
      "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
      "user_id": 2,
      "type": "cash_in",
      "reason": "change_refill",
      "amount": 100000.00,
      "note": "Added change supply",
      "created_at": "2026-03-03T11:15:00Z",
      "user_name": "Sarah Cashier"
    }
  ]
}
```

**Error `404`:** Shift not found.

---

## 10. Floor Areas

### `GET /api/v1/floor-areas`

> **Roles:** admin, manager, cashier

List floor areas for a branch.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch (required) |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "branch_id": 1,
      "name": "Indoor",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 2,
      "branch_id": 1,
      "name": "Outdoor",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 3,
      "branch_id": 1,
      "name": "VIP Room",
      "sort_order": 2,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    }
  ]
}
```

---

### `POST /api/v1/floor-areas`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "branch_id": 1,
  "name": "Rooftop",
  "sort_order": 3
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `branch_id` | int | ✅ | must exist |
| `name` | string | ✅ | max 50 chars, unique per branch |
| `sort_order` | int | ❌ | defaults to 0 |

**Response `201 Created`:** Returns the created floor area object.

---

### `PUT /api/v1/floor-areas/:id`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "name": "Rooftop Garden",
  "sort_order": 4
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ❌ | max 50 chars |
| `sort_order` | int | ❌ | — |
| `is_active` | bool | ❌ | — |

**Response `200 OK`:** Returns the updated floor area object.

---

### `DELETE /api/v1/floor-areas/:id`

> **Roles:** admin, manager, cashier

Hard delete a floor area. Fails if tables still reference it.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "floor area deleted successfully"
  }
}
```

---

## 11. Tables

### `GET /api/v1/tables`

> **Roles:** admin, manager, cashier

List tables with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `floor_area_id` | int | Filter by floor area |
| `status` | string | `available`, `occupied`, `reserved`, `maintenance` |
| `is_active` | bool | Filter by active status |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "branch_id": 1,
      "floor_area_id": 1,
      "table_number": "A1",
      "capacity": 4,
      "status": "available",
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-03-03T10:00:00Z",
      "floor_area_name": "Indoor",
      "branch_name": "Tempest Cafe - Sudirman"
    },
    {
      "id": 2,
      "branch_id": 1,
      "floor_area_id": 1,
      "table_number": "A2",
      "capacity": 6,
      "status": "occupied",
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-03-03T12:30:00Z",
      "floor_area_name": "Indoor",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/tables/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the table object (same shape as list item).

---

### `POST /api/v1/tables`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "branch_id": 1,
  "floor_area_id": 1,
  "table_number": "A5",
  "capacity": 8
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `branch_id` | int | ✅ | must exist |
| `floor_area_id` | int | ✅ | must exist, must belong to same branch |
| `table_number` | string | ✅ | max 10 chars, unique per branch |
| `capacity` | int | ✅ | >= 1 |

**Response `201 Created`:** Returns the created table object.

---

### `PUT /api/v1/tables/:id`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "table_number": "A5-VIP",
  "capacity": 10
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `floor_area_id` | int | ❌ | — |
| `table_number` | string | ❌ | max 10 chars |
| `capacity` | int | ❌ | >= 1 |
| `is_active` | bool | ❌ | — |

**Response `200 OK`:** Returns the updated table object.

---

### `PATCH /api/v1/tables/:id/status`

> **Roles:** admin, manager, cashier

Change table status.

**Request Body:**
```json
{
  "status": "occupied"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | ✅ | `available`, `occupied`, `reserved`, `maintenance` |

**Valid status transitions:**
- `available` → `occupied`, `reserved`, `maintenance`
- `occupied` → `available`
- `reserved` → `occupied`, `available`
- `maintenance` → `available`

**Response `200 OK`:** Returns the updated table object.

---

### `DELETE /api/v1/tables/:id`

> **Roles:** admin, manager, cashier

Soft-delete a table. Sets `is_active = false`. Table must not be `occupied` or `reserved`.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "table deleted successfully"
  }
}
```

---

## 12. Categories

### `GET /api/v1/categories`

> **Roles:** admin, manager, cashier

Flat list of all categories.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "parent_id": null,
      "name": "Food",
      "description": "All food items",
      "button_color": "#f4a261",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 2,
      "parent_id": 1,
      "name": "Appetizers",
      "description": null,
      "button_color": null,
      "sort_order": 1,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 3,
      "parent_id": 1,
      "name": "Main Course",
      "description": null,
      "button_color": null,
      "sort_order": 2,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 4,
      "parent_id": null,
      "name": "Beverages",
      "description": "All drinks",
      "button_color": "#c2dbe9",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 4,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/categories/tree`

> **Roles:** admin, manager, cashier

Nested tree structure with children.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "parent_id": null,
      "name": "Food",
      "description": "All food items",
      "button_color": "#f4a261",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z",
      "children": [
        {
          "id": 2,
          "parent_id": 1,
          "name": "Appetizers",
          "description": null,
          "button_color": null,
          "sort_order": 1,
          "is_active": true,
          "created_at": "2026-01-15T08:00:00Z",
          "updated_at": "2026-01-15T08:00:00Z",
          "children": []
        },
        {
          "id": 3,
          "parent_id": 1,
          "name": "Main Course",
          "description": null,
          "button_color": null,
          "sort_order": 2,
          "is_active": true,
          "created_at": "2026-01-15T08:00:00Z",
          "updated_at": "2026-01-15T08:00:00Z",
          "children": []
        }
      ]
    },
    {
      "id": 4,
      "parent_id": null,
      "name": "Beverages",
      "description": "All drinks",
      "button_color": "#c2dbe9",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z",
      "children": []
    }
  ]
}
```

---

### `GET /api/v1/categories/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the category object.

---

### `POST /api/v1/categories`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "parent_id": 1,
  "name": "Desserts",
  "description": "Sweet treats",
  "button_color": "#e76f51",
  "sort_order": 3
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `parent_id` | int | ❌ | null for root category, or an existing category ID |
| `name` | string | ✅ | max 100 chars |
| `description` | string | ❌ | — |
| `button_color` | string | ❌ | must be `#RRGGBB` hex format (e.g. `#c2dbe9`), or null |
| `sort_order` | int | ❌ | defaults to 0 |

**Response `201 Created`:** Returns the created category object.

---

### `PUT /api/v1/categories/:id`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "name": "Desserts & Sweets",
  "button_color": "#e9c46a",
  "sort_order": 5
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `parent_id` | int | ❌ | cannot be self or descendant |
| `name` | string | ❌ | max 100 chars |
| `description` | string | ❌ | — |
| `button_color` | string | ❌ | must be `#RRGGBB` hex format, or null to clear |
| `sort_order` | int | ❌ | — |
| `is_active` | bool | ❌ | — |

**Response `200 OK`:** Returns the updated category object.

---

### `DELETE /api/v1/categories/:id`

> **Roles:** admin, manager, cashier

Soft-delete. Fails if the category still has active menu items.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "category deleted successfully"
  }
}
```

**Error `400`:** `"reassign menu items first"` — move menu items to another category before deleting.

---

## 13. Menu Items

### `GET /api/v1/menu-items`

> **Roles:** admin, manager, cashier

List menu items with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category_id` | int | Filter by category |
| `pricing_type` | string | `fixed` or `weight_based` |
| `is_available` | bool | Filter by availability |
| `is_active` | bool | Filter by active status |
| `search` | string | Search name, SKU, or barcode |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "category_id": 3,
      "name": "Nasi Goreng Spesial",
      "description": "Fried rice with egg, chicken, and vegetables",
      "sku": "FOOD-001",
      "barcode": "8991234567001",
      "image_url": "https://storage.supabase.co/menu/nasi-goreng.jpg",
      "pricing_type": "fixed",
      "unit_of_measure": "portion",
      "price": 45000.00,
      "cost": 18000.00,
      "min_order_qty": 1.000,
      "preparation_time_minutes": 15,
      "is_available": true,
      "is_active": true,
      "sort_order": 0,
      "created_at": "2026-01-20T10:00:00Z",
      "updated_at": "2026-02-15T14:00:00Z",
      "category_name": "Main Course"
    },
    {
      "id": 2,
      "category_id": 3,
      "name": "Wagyu Steak",
      "description": "Premium A5 wagyu beef",
      "sku": "FOOD-002",
      "barcode": null,
      "image_url": null,
      "pricing_type": "weight_based",
      "unit_of_measure": "gram",
      "price": 1500.00,
      "cost": 900.00,
      "min_order_qty": 100.000,
      "preparation_time_minutes": 25,
      "is_available": true,
      "is_active": true,
      "sort_order": 1,
      "created_at": "2026-01-20T10:00:00Z",
      "updated_at": "2026-01-20T10:00:00Z",
      "category_name": "Main Course"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/menu-items/:id`

> **Roles:** admin, manager, cashier

Get a single menu item **with modifier groups and ingredients attached**.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "category_id": 3,
    "name": "Nasi Goreng Spesial",
    "description": "Fried rice with egg, chicken, and vegetables",
    "sku": "FOOD-001",
    "barcode": "8991234567001",
    "image_url": "https://storage.supabase.co/menu/nasi-goreng.jpg",
    "pricing_type": "fixed",
    "unit_of_measure": "portion",
    "price": 45000.00,
    "cost": 18000.00,
    "min_order_qty": 1.000,
    "preparation_time_minutes": 15,
    "is_available": true,
    "is_active": true,
    "sort_order": 0,
    "created_at": "2026-01-20T10:00:00Z",
    "updated_at": "2026-02-15T14:00:00Z",
    "category_name": "Main Course",
    "modifier_groups": [
      {
        "id": 1,
        "name": "Spice Level",
        "description": null,
        "is_required": true,
        "min_selections": 1,
        "max_selections": 1,
        "sort_order": 0,
        "is_active": true,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-20T10:00:00Z",
        "modifiers": [
          {
            "id": 1,
            "modifier_group_id": 1,
            "name": "Mild",
            "extra_price": 0.00,
            "sort_order": 0,
            "is_active": true,
            "created_at": "2026-01-20T10:00:00Z",
            "updated_at": "2026-01-20T10:00:00Z"
          },
          {
            "id": 2,
            "modifier_group_id": 1,
            "name": "Medium",
            "extra_price": 0.00,
            "sort_order": 1,
            "is_active": true,
            "created_at": "2026-01-20T10:00:00Z",
            "updated_at": "2026-01-20T10:00:00Z"
          },
          {
            "id": 3,
            "modifier_group_id": 1,
            "name": "Extra Spicy",
            "extra_price": 5000.00,
            "sort_order": 2,
            "is_active": true,
            "created_at": "2026-01-20T10:00:00Z",
            "updated_at": "2026-01-20T10:00:00Z"
          }
        ]
      },
      {
        "id": 2,
        "name": "Add-ons",
        "description": "Extra toppings",
        "is_required": false,
        "min_selections": 0,
        "max_selections": 3,
        "sort_order": 1,
        "is_active": true,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-20T10:00:00Z",
        "modifiers": [
          {
            "id": 4,
            "modifier_group_id": 2,
            "name": "Extra Egg",
            "extra_price": 8000.00,
            "sort_order": 0,
            "is_active": true,
            "created_at": "2026-01-20T10:00:00Z",
            "updated_at": "2026-01-20T10:00:00Z"
          },
          {
            "id": 5,
            "modifier_group_id": 2,
            "name": "Extra Chicken",
            "extra_price": 15000.00,
            "sort_order": 1,
            "is_active": true,
            "created_at": "2026-01-20T10:00:00Z",
            "updated_at": "2026-01-20T10:00:00Z"
          }
        ]
      }
    ],
    "ingredients": [
      {
        "id": 1,
        "menu_item_id": 1,
        "inventory_id": 5,
        "quantity_needed": 0.200,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-20T10:00:00Z",
        "inventory_name": "Rice",
        "unit_of_measure": "kg",
        "branch_name": "Tempest Cafe - Sudirman",
        "stock_quantity": 50.000
      },
      {
        "id": 2,
        "menu_item_id": 1,
        "inventory_id": 8,
        "quantity_needed": 0.150,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-20T10:00:00Z",
        "inventory_name": "Chicken Breast",
        "unit_of_measure": "kg",
        "branch_name": "Tempest Cafe - Sudirman",
        "stock_quantity": 25.000
      }
    ]
  }
}
```

---

### `POST /api/v1/menu-items`

> **Roles:** admin, manager, cashier

Create a menu item. Optionally include `ingredients` to define the recipe (which raw inventory ingredients are consumed and in what quantity).

> **Changed:** Creating a menu item no longer auto-creates inventory records. Inventories are independent raw ingredient records that must be created separately via `POST /api/v1/inventory` before being referenced here.

**Request Body:**
```json
{
  "category_id": 3,
  "name": "Mie Goreng",
  "description": "Stir-fried noodles with vegetables",
  "sku": "FOOD-003",
  "barcode": "8991234567003",
  "image_url": null,
  "pricing_type": "fixed",
  "unit_of_measure": "portion",
  "price": 35000.00,
  "cost": 12000.00,
  "min_order_qty": 1,
  "preparation_time_minutes": 12,
  "sort_order": 2,
  "ingredients": [
    { "inventory_id": 5, "quantity_needed": 0.180 },
    { "inventory_id": 12, "quantity_needed": 0.050 }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `category_id` | int | ❌ | — |
| `name` | string | ✅ | max 150 chars |
| `description` | string | ❌ | — |
| `sku` | string | ❌ | max 50, unique |
| `barcode` | string | ❌ | max 50 |
| `image_url` | string | ❌ | max 500 |
| `pricing_type` | string | ✅ | `fixed` or `weight_based` |
| `unit_of_measure` | string | ✅ | `piece`, `kg`, `gram`, `ons`, `liter`, `ml`, `portion` |
| `price` | float | ✅ | > 0 |
| `cost` | float | ❌ | >= 0 |
| `min_order_qty` | float | ✅ | > 0 |
| `preparation_time_minutes` | int | ❌ | >= 0 |
| `sort_order` | int | ❌ | defaults to 0 |
| `ingredients` | array | ❌ | Array of `{ inventory_id: int, quantity_needed: float }`. Links menu item to inventory items (recipe). |

**Response `201 Created`:** Returns the created menu item object (with `ingredients` if provided).

---

### `PUT /api/v1/menu-items/:id`

> **Roles:** admin, manager, cashier

Update a menu item. Only send fields you want to change. Include `ingredients` to **replace** the entire ingredient list.

**Request Body:**
```json
{
  "price": 38000.00,
  "description": "Stir-fried noodles with egg and vegetables",
  "ingredients": [
    { "inventory_id": 5, "quantity_needed": 0.200 },
    { "inventory_id": 8, "quantity_needed": 0.180 },
    { "inventory_id": 12, "quantity_needed": 0.050 }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `category_id` | int | ❌ | — |
| `name` | string | ❌ | max 150 chars |
| `description` | string | ❌ | — |
| `sku` | string | ❌ | max 50, unique |
| `barcode` | string | ❌ | max 50 |
| `image_url` | string | ❌ | max 500 |
| `pricing_type` | string | ❌ | `fixed` or `weight_based` |
| `unit_of_measure` | string | ❌ | `piece`, `kg`, `gram`, `ons`, `liter`, `ml`, `portion` |
| `price` | float | ❌ | > 0 |
| `cost` | float | ❌ | >= 0 |
| `min_order_qty` | float | ❌ | > 0 |
| `preparation_time_minutes` | int | ❌ | >= 0 |
| `is_available` | bool | ❌ | — |
| `is_active` | bool | ❌ | — |
| `sort_order` | int | ❌ | — |
| `ingredients` | array | ❌ | If provided, **replaces all** existing ingredients. Array of `{ inventory_id: int, quantity_needed: float }`. Send `[]` to clear. If omitted, ingredients are left unchanged. |

**Response `200 OK`:** Returns the updated menu item object (with `ingredients`).

---

### `PATCH /api/v1/menu-items/:id/availability`

> **Roles:** admin, manager, cashier

Toggle item availability (e.g., mark as out of stock).

**Request Body:**
```json
{
  "is_available": false
}
```

**Response `200 OK`:** Returns the updated menu item object.

---

### `DELETE /api/v1/menu-items/:id`

> **Roles:** admin, manager, cashier

Soft-delete a menu item. Sets `is_active = false`.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "menu item deleted successfully"
  }
}
```

---

## 14. Modifier Groups

### `GET /api/v1/modifier-groups`

> **Roles:** admin, manager, cashier

List all modifier groups with their nested modifiers.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Spice Level",
      "description": null,
      "is_required": true,
      "min_selections": 1,
      "max_selections": 1,
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-01-20T10:00:00Z",
      "updated_at": "2026-01-20T10:00:00Z",
      "modifiers": [
        {
          "id": 1,
          "modifier_group_id": 1,
          "name": "Mild",
          "extra_price": 0.00,
          "sort_order": 0,
          "is_active": true,
          "created_at": "2026-01-20T10:00:00Z",
          "updated_at": "2026-01-20T10:00:00Z"
        },
        {
          "id": 2,
          "modifier_group_id": 1,
          "name": "Medium",
          "extra_price": 0.00,
          "sort_order": 1,
          "is_active": true,
          "created_at": "2026-01-20T10:00:00Z",
          "updated_at": "2026-01-20T10:00:00Z"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/modifier-groups/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the modifier group with nested modifiers.

---

### `POST /api/v1/modifier-groups`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "name": "Cooking Method",
  "description": "How to cook the meat",
  "is_required": true,
  "min_selections": 1,
  "max_selections": 1,
  "sort_order": 0
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | max 100 chars |
| `description` | string | ❌ | — |
| `is_required` | bool | ❌ | defaults to false |
| `min_selections` | int | ❌ | >= 0 |
| `max_selections` | int | ✅ | >= 1, must be >= min_selections |
| `sort_order` | int | ❌ | defaults to 0 |

**Response `201 Created`:** Returns the created modifier group.

---

### `PUT /api/v1/modifier-groups/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the updated modifier group.

---

### `DELETE /api/v1/modifier-groups/:id`

> **Roles:** admin, manager, cashier

Soft-delete a modifier group.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "modifier group deleted successfully"
  }
}
```

---

### `POST /api/v1/modifier-groups/:id/modifiers`

> **Roles:** admin, manager, cashier

Add a modifier option to a group.

**Request Body:**
```json
{
  "name": "Grilled",
  "extra_price": 10000.00,
  "sort_order": 0
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | max 100 chars |
| `extra_price` | float | ❌ | >= 0 (defaults to 0) |
| `sort_order` | int | ❌ | defaults to 0 |

**Response `201 Created`:** Returns the created modifier.

---

## 15. Modifiers

### `PUT /api/v1/modifiers/:id`

> **Roles:** admin, manager, cashier

Update a single modifier.

**Request Body:**
```json
{
  "name": "Pan-Seared",
  "extra_price": 12000.00
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ❌ | max 100 chars |
| `extra_price` | float | ❌ | >= 0 |
| `sort_order` | int | ❌ | — |
| `is_active` | bool | ❌ | — |

**Response `200 OK`:** Returns the updated modifier.

---

### `DELETE /api/v1/modifiers/:id`

> **Roles:** admin, manager, cashier

Soft-delete a modifier.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "modifier deleted successfully"
  }
}
```

---

## 16. Menu ↔ Modifier Links

### `POST /api/v1/menu-items/:id/modifier-groups`

> **Roles:** admin, manager, cashier

Assign a modifier group to a menu item.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | Menu item ID |

**Request Body:**
```json
{
  "modifier_group_id": 1,
  "sort_order": 0
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `modifier_group_id` | int | ✅ | must exist |
| `sort_order` | int | ❌ | defaults to 0 |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "message": "modifier group assigned successfully"
  }
}
```

**Error `409`:** `"modifier group already assigned to menu item"`

---

### `DELETE /api/v1/menu-items/:id/modifier-groups/:groupId`

> **Roles:** admin, manager, cashier

Unassign a modifier group from a menu item.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | Menu item ID |
| `groupId` | int | Modifier group ID |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "modifier group unassigned successfully"
  }
}
```

---

## 17. Customers

### `GET /api/v1/customers`

> **Roles:** all staff

List and search customers.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search name, phone, or email |
| `is_active` | bool | Filter by active status |
| `sort_by` | string | `name`, `visits`, `spent`, `points`, `created_at` |
| `sort_dir` | string | `asc` or `desc` |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Budi Santoso",
      "phone": "081234567890",
      "email": "budi@email.com",
      "address": "Jl. Merdeka No. 10",
      "loyalty_points": 1500,
      "total_visits": 25,
      "total_spent": 3750000.00,
      "notes": "Regular customer, prefers corner table",
      "is_active": true,
      "created_at": "2026-01-20T10:00:00Z",
      "updated_at": "2026-03-01T12:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

> **Note:** `loyalty_points`, `total_visits`, and `total_spent` are managed by the POS order system and are **read-only** from the CMS.

---

### `GET /api/v1/customers/:id`

> **Roles:** all staff

**Response `200 OK`:** Returns the customer object.

---

### `POST /api/v1/customers`

> **Roles:** all staff

**Request Body:**
```json
{
  "name": "Siti Rahayu",
  "phone": "081298765432",
  "email": "siti@email.com",
  "address": "Jl. Veteran No. 5",
  "notes": "Allergic to peanuts"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | max 100 chars |
| `phone` | string | ❌ | max 20 chars |
| `email` | string | ❌ | valid email, max 255 chars |
| `address` | string | ❌ | — |
| `notes` | string | ❌ | — |

**Response `201 Created`:** Returns the created customer object.

---

### `PUT /api/v1/customers/:id`

> **Roles:** all staff

Update customer profile fields only (not loyalty/visits/spent).

**Request Body:**
```json
{
  "phone": "081200009999",
  "notes": "Allergic to peanuts and shellfish"
}
```

**Response `200 OK`:** Returns the updated customer object.

---

## 18. Reservations

### `GET /api/v1/reservations`

> **Roles:** all staff

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `table_id` | int | Filter by table |
| `status` | string | `confirmed`, `seated`, `completed`, `no_show`, `cancelled` |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "branch_id": 1,
      "table_id": 3,
      "customer_id": 1,
      "customer_name": "Budi Santoso",
      "customer_phone": "081234567890",
      "guest_count": 4,
      "reservation_datetime": "2026-03-05T19:00:00Z",
      "duration_minutes": 120,
      "status": "confirmed",
      "notes": "Birthday dinner, needs cake table",
      "created_by": 2,
      "created_at": "2026-03-03T10:00:00Z",
      "updated_at": "2026-03-03T10:00:00Z",
      "table_number": "A3",
      "created_by_name": "Sarah Cashier",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/reservations/:id`

> **Roles:** all staff

**Response `200 OK`:** Returns the reservation object.

---

### `POST /api/v1/reservations`

> **Roles:** all staff

Create a reservation. `created_by` is set from the authenticated user.

**Request Body:**
```json
{
  "branch_id": 1,
  "table_id": 3,
  "customer_id": 1,
  "customer_name": "Budi Santoso",
  "customer_phone": "081234567890",
  "guest_count": 4,
  "reservation_datetime": "2026-03-05T19:00:00+07:00",
  "duration_minutes": 120,
  "notes": "Birthday dinner"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `branch_id` | int | ✅ | must exist |
| `table_id` | int | ❌ | must exist and be available for the time slot |
| `customer_id` | int | ❌ | existing customer ID |
| `customer_name` | string | ✅ | max 100 chars |
| `customer_phone` | string | ❌ | max 20 chars |
| `guest_count` | int | ✅ | >= 1 |
| `reservation_datetime` | string | ✅ | ISO 8601 format |
| `duration_minutes` | int | ❌ | >= 15 (defaults to 120) |
| `notes` | string | ❌ | — |

**Response `201 Created`:** Returns the created reservation object.

**Error `409`:** `"table is not available for the requested time slot"` — overlapping reservation exists.

---

### `PUT /api/v1/reservations/:id`

> **Roles:** all staff

Update a reservation. Re-checks availability if table or time changes.

**Request Body:**
```json
{
  "guest_count": 6,
  "table_id": 5,
  "notes": "Birthday dinner, 6 guests now"
}
```

**Response `200 OK`:** Returns the updated reservation object.

---

### `PATCH /api/v1/reservations/:id/status`

> **Roles:** all staff

Change reservation status.

**Request Body:**
```json
{
  "status": "seated"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | ✅ | `confirmed`, `seated`, `completed`, `no_show`, `cancelled` |

**Valid transitions:**
- `confirmed` → `seated`, `no_show`, `cancelled`
- `seated` → `completed`

**Side effects:**
- `seated` → auto-sets table status to `occupied`
- `completed` / `cancelled` → auto-sets table status to `available`

**Response `200 OK`:** Returns the updated reservation object.

---

## 19. Orders (Read-Only)

> Orders are created by the POS app and synced via PowerSync. The CMS can only **read** orders.

### `GET /api/v1/orders`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `status` | string | `pending`, `confirmed`, `preparing`, `ready`, `served`, `completed`, `cancelled` |
| `payment_status` | string | `unpaid`, `partial`, `paid`, `refunded` |
| `order_type` | string | `dine_in` or `takeaway` |
| `cashier_id` | int | Filter by cashier |
| `customer_id` | int | Filter by customer |
| `shift_id` | string (UUID) | Filter by shift |
| `table_id` | int | Filter by table |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |
| `search` | string | Search by order number |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "order_number": "ORD-20260303-0001",
      "branch_id": 1,
      "table_id": 2,
      "cashier_id": 2,
      "customer_id": 1,
      "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
      "order_type": "dine_in",
      "status": "completed",
      "guest_count": 2,
      "subtotal": 125000.00,
      "discount_amount": 12500.00,
      "tax_amount": 12375.00,
      "service_charge": 5625.00,
      "rounding_amount": 0.00,
      "total": 130500.00,
      "payment_status": "paid",
      "notes": null,
      "voided_by": null,
      "voided_at": null,
      "void_reason": null,
      "created_at": "2026-03-03T12:30:00Z",
      "updated_at": "2026-03-03T13:15:00Z",
      "cashier_name": "Sarah Cashier",
      "customer_name": "Budi Santoso",
      "table_number": "A2",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/orders/:id`

> **Roles:** admin, manager, cashier

Get full order detail with nested items, modifiers, payments, and discounts.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "order_number": "ORD-20260303-0001",
    "branch_id": 1,
    "table_id": 2,
    "cashier_id": 2,
    "customer_id": 1,
    "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
    "order_type": "dine_in",
    "status": "completed",
    "guest_count": 2,
    "subtotal": 125000.00,
    "discount_amount": 12500.00,
    "tax_amount": 12375.00,
    "service_charge": 5625.00,
    "rounding_amount": 0.00,
    "total": 130500.00,
    "payment_status": "paid",
    "notes": null,
    "voided_by": null,
    "voided_at": null,
    "void_reason": null,
    "created_at": "2026-03-03T12:30:00Z",
    "updated_at": "2026-03-03T13:15:00Z",
    "cashier_name": "Sarah Cashier",
    "customer_name": "Budi Santoso",
    "table_number": "A2",
    "branch_name": "Tempest Cafe - Sudirman",
    "items": [
      {
        "id": "7f9c2e60-aa11-4b22-9c33-d44e55f66001",
        "order_id": "550e8400-e29b-41d4-a716-446655440010",
        "menu_item_id": 1,
        "menu_item_name": "Nasi Goreng Spesial",
        "quantity": 2.000,
        "unit_of_measure": "portion",
        "unit_price": 45000.00,
        "modifier_total": 5000.00,
        "subtotal": 95000.00,
        "discount_amount": 0.00,
        "total": 95000.00,
        "notes": "No onion",
        "is_voided": false,
        "voided_by": null,
        "void_reason": null,
        "created_at": "2026-03-03T12:30:00Z",
        "modifiers": [
          {
            "id": "8a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9",
            "order_item_id": "7f9c2e60-aa11-4b22-9c33-d44e55f66001",
            "modifier_id": 3,
            "modifier_name": "Extra Spicy",
            "modifier_group_name": "Spice Level",
            "extra_price": 5000.00
          }
        ]
      },
      {
        "id": "7f9c2e60-aa11-4b22-9c33-d44e55f66002",
        "order_id": "550e8400-e29b-41d4-a716-446655440010",
        "menu_item_id": 5,
        "menu_item_name": "Es Teh Manis",
        "quantity": 2.000,
        "unit_of_measure": "portion",
        "unit_price": 15000.00,
        "modifier_total": 0.00,
        "subtotal": 30000.00,
        "discount_amount": 0.00,
        "total": 30000.00,
        "notes": null,
        "is_voided": false,
        "voided_by": null,
        "void_reason": null,
        "created_at": "2026-03-03T12:30:00Z",
        "modifiers": []
      }
    ],
    "payments": [
      {
        "id": "4b3c2d1e-0f9a-48b7-c6d5-e4f3a2b1c0d9",
        "order_id": "550e8400-e29b-41d4-a716-446655440010",
        "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
        "payment_method": "cash",
        "amount": 150000.00,
        "change_amount": 19500.00,
        "reference_number": null,
        "paid_at": "2026-03-03T13:15:00Z"
      }
    ],
    "discounts": [
      {
        "id": "3a2b1c0d-9e8f-4756-b4c3-d2e1f0a9b8c7",
        "order_id": "550e8400-e29b-41d4-a716-446655440010",
        "discount_id": 1,
        "discount_name": "Weekday Lunch 10%",
        "discount_type": "percentage",
        "discount_value": 10.00,
        "applied_amount": 12500.00,
        "applied_by": 2,
        "created_at": "2026-03-03T12:30:00Z"
      }
    ]
  }
}
```

---

## 20. Discounts

### `GET /api/v1/discounts`

> **Roles:** admin, manager, cashier

List all discounts.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Weekday Lunch 10%",
      "description": "10% off for weekday lunch orders",
      "discount_type": "percentage",
      "value": 10.00,
      "min_order_amount": 50000.00,
      "max_discount_amount": 50000.00,
      "valid_from": "2026-01-01T00:00:00Z",
      "valid_until": "2026-12-31T23:59:59Z",
      "is_active": true,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 2,
      "name": "New Customer Rp 25.000",
      "description": "Rp 25.000 off for first-time customers",
      "discount_type": "fixed_amount",
      "value": 25000.00,
      "min_order_amount": 100000.00,
      "max_discount_amount": null,
      "valid_from": null,
      "valid_until": null,
      "is_active": true,
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-02-01T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/discounts/active`

> **Roles:** admin, manager, cashier

List only currently active and valid discounts (within date range).

**Response `200 OK`:** Same shape as the list above, but filtered.

---

### `GET /api/v1/discounts/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the discount object.

---

### `POST /api/v1/discounts`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "name": "Happy Hour 15%",
  "description": "15% off between 3-5 PM",
  "discount_type": "percentage",
  "value": 15.00,
  "min_order_amount": 0,
  "max_discount_amount": 75000.00,
  "valid_from": "2026-03-01T00:00:00Z",
  "valid_until": "2026-06-30T23:59:59Z"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | max 100 chars |
| `description` | string | ❌ | — |
| `discount_type` | string | ✅ | `percentage` or `fixed_amount` |
| `value` | float | ✅ | > 0 (if percentage, max 100) |
| `min_order_amount` | float | ❌ | >= 0 |
| `max_discount_amount` | float | ❌ | > 0 (cap for percentage discounts) |
| `valid_from` | string | ❌ | ISO 8601 |
| `valid_until` | string | ❌ | ISO 8601, must be after valid_from |

**Response `201 Created`:** Returns the created discount object.

---

### `PUT /api/v1/discounts/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the updated discount object.

---

### `DELETE /api/v1/discounts/:id`

> **Roles:** admin, manager, cashier

Soft-delete (deactivate) a discount.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "discount deleted successfully"
  }
}
```

---

## 21. Inventory

> **What is an inventory item?**
> An inventory record represents a **raw ingredient** (e.g. Chicken, All-Purpose Flour, Cooking Oil) — not a finished menu item.
> Menu items reference inventories through the `ingredients` recipe field (`menu_item_ingredients`).
> Stock increases when a purchase order is received; stock decreases when menu items are sold.

---

### `POST /api/v1/inventory`

> **Roles:** admin, manager, cashier
> **⚠️ New endpoint added in inventory refactor**

Create a new raw ingredient inventory record for a branch.

**Request Body:**
```json
{
  "branch_id": 1,
  "name": "Chicken Breast",
  "unit_of_measure": "kg",
  "description": "Fresh chicken breast, boneless",
  "low_stock_threshold": 5.0
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `branch_id` | int | ✅ | must exist |
| `name` | string | ✅ | max 150 chars, unique per branch |
| `unit_of_measure` | string | ✅ | `piece`, `kg`, `gram`, `ons`, `liter`, `ml`, `portion` |
| `description` | string | ❌ | — |
| `low_stock_threshold` | float | ❌ | >= 0, defaults to 10 |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": 8,
    "branch_id": 1,
    "name": "Chicken Breast",
    "unit_of_measure": "kg",
    "description": "Fresh chicken breast, boneless",
    "stock_quantity": 0.000,
    "low_stock_threshold": 5.000,
    "created_at": "2026-03-25T10:00:00Z",
    "updated_at": "2026-03-25T10:00:00Z"
  }
}
```

---

### `GET /api/v1/inventory`

> **Roles:** admin, manager, cashier

List raw ingredient stock levelswith optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `low_stock_only` | bool | Only items where stock ≤ threshold |
| `name` | string | Partial name search (case-insensitive) |
| `search` | string | Alias for `name` — use this for consistency with other list endpoints |
| `page` | int | Page number |
| `page_size` | int | Items per page (max 100) |

> **Note:** `?search=` and `?name=` are interchangeable. Both perform a case-insensitive partial match on the ingredient name across **all** rows in the database — not just the current page. Use these server-side filters instead of filtering client-side.

> **Changed:** `menu_item_id` filter removed. `name` / `search` filter added.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "branch_id": 1,
      "name": "Rice",
      "unit_of_measure": "kg",
      "description": null,
      "stock_quantity": 50.000,
      "low_stock_threshold": 10.000,
      "created_at": "2026-03-01T09:00:00Z",
      "updated_at": "2026-03-03T14:00:00Z",
      "branch_name": "Tempest Cafe - Sudirman",
      "is_low_stock": false
    },
    {
      "id": 8,
      "branch_id": 1,
      "name": "Chicken Breast",
      "unit_of_measure": "kg",
      "description": "Fresh chicken breast, boneless",
      "stock_quantity": 3.500,
      "low_stock_threshold": 5.000,
      "created_at": "2026-03-01T09:00:00Z",
      "updated_at": "2026-03-03T12:00:00Z",
      "branch_name": "Tempest Cafe - Sudirman",
      "is_low_stock": true
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

> **Changed fields vs old response:**
> - ❌ Removed: `menu_item_id`, `menu_item_name`, `menu_item_sku`
> - ✅ Added: `name`, `unit_of_measure`, `description`, `created_at`

---

### `GET /api/v1/inventory/search`

> **Roles:** admin, manager, cashier

Lightweight autocomplete searchendpoint for ingredient pickers (e.g. when adding ingredients to a menu item). Returns up to 50 matching inventory items with minimal fields — designed for search-as-you-type dropdowns.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | ✅ | Search term — partial match on ingredient name (case-insensitive) |
| `branch_id` | int | ❌ | Filter by branch |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "branch_id": 1,
      "name": "Rice",
      "unit_of_measure": "kg"
    },
    {
      "id": 12,
      "branch_id": 1,
      "name": "Jasmine Rice",
      "unit_of_measure": "kg"
    }
  ]
}
```

**Error `400`:** `q` parameter is missing or empty.

> **Usage tip:** Call this endpoint as the user types in an ingredient picker. Returns at most 50 results — no pagination needed. To browse the full inventory list with pagination, use `GET /api/v1/inventory`.

---

### `GET /api/v1/inventory/:id`

> **Roles:** admin, manager, cashier

Get one raw ingredient inventory item by ID.

**Response `200 OK`:** Same object shape as list items.

**Error `404`:** `"inventory not found"`

---

### `PUT /api/v1/inventory/:id`

> **Roles:** admin, manager, cashier

Update an inventory item.

**Request Body (all optional):**
```json
{
  "branch_id": 1,
  "name": "Chicken Thigh",
  "unit_of_measure": "kg",
  "description": "Fresh chicken thigh, boneless",
  "low_stock_threshold": 6.000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `branch_id` | int | ❌ | must exist |
| `name` | string | ❌ | max 150 chars |
| `unit_of_measure` | string | ❌ | `piece`, `kg`, `gram`, `ons`, `liter`, `ml`, `portion` |
| `description` | string | ❌ | nullable |
| `low_stock_threshold` | float | ❌ | >= 0 |

**Response `200 OK`:** Returns updated inventory object.

**Error `404`:** `"inventory not found"`

---

### `DELETE /api/v1/inventory/:id`

> **Roles:** admin, manager, cashier

Delete an inventory item.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "inventory deleted successfully"
  }
}
```

**Error `404`:** `"inventory not found"`

**Error `409`:** Inventory item is still referenced by other records (e.g. recipe ingredients, purchase items, movement history).

---

### `GET /api/v1/inventory/low-stock`

> **Roles:** admin, manager, cashier

Get only items with stock at or below threshold.`branch_id` is required.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | **Required** — filter by branch |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:** Same shape as inventory list, filtered to `is_low_stock = true`.

---

### `POST /api/v1/inventory/adjust`

> **Roles:** admin, manager

Manually adjust ingredient stock (waste, count correction, transfer).

**Request Body:**
```json
{
  "inventory_id": 8,
  "quantity_change": 10.000,
  "movement_type": "adjustment",
  "reason": "Physical count correction"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `inventory_id` | int | ✅ | must exist |
| `quantity_change` | float | ✅ | positive (add) or negative (remove). Result must be >= 0. |
| `movement_type` | string | ✅ | `adjustment`, `waste`, `transfer` |
| `reason` | string | ❌ | — |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 8,
    "branch_id": 1,
    "name": "Chicken Breast",
    "unit_of_measure": "kg",
    "description": "Fresh chicken breast, boneless",
    "stock_quantity": 13.500,
    "low_stock_threshold": 5.000,
    "created_at": "2026-03-01T09:00:00Z",
    "updated_at": "2026-03-25T15:00:00Z"
  }
}
```

**Error `400`:** `"insufficient stock: resulting quantity cannot be negative"`

---

### `PATCH /api/v1/inventory/:id/threshold`

> **Roles:** admin, manager, cashier

Update the low stock alert threshold for an ingredient.

**Request Body:**
```json
{
  "low_stock_threshold": 8.000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `low_stock_threshold` | float | ✅ | >= 0 |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "message": "inventory threshold updated successfully" }
}
```

---

### `GET /api/v1/inventory/:id/movements`

> **Roles:** admin, manager, cashier

Get the stock movement historyfor a raw ingredient.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "2f1e0d9c-8b7a-4655-93b2-c1d0e9f8a7b6",
      "inventory_id": 8,
      "user_id": 1,
      "movement_type": "adjustment",
      "quantity_change": 10.000,
      "quantity_before": 3.500,
      "quantity_after": 13.500,
      "reference_type": "manual_adjustment",
      "reference_id": null,
      "reason": "Physical count correction",
      "created_at": "2026-03-25T15:00:00Z",
      "user_name": "John Admin"
    },
    {
      "id": "1e0d9c8b-7a65-4544-82a1-b0c9d8e7f6a5",
      "inventory_id": 8,
      "user_id": 1,
      "movement_type": "purchase_in",
      "quantity_change": 20.000,
      "quantity_before": 0.000,
      "quantity_after": 20.000,
      "reference_type": "purchase",
      "reference_id": 1,
      "reason": "Received from purchase PO-20260301-0001",
      "created_at": "2026-03-01T10:00:00Z",
      "user_name": "John Admin"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

## 22. Suppliers

### `GET /api/v1/suppliers`

> **Roles:** admin, manager, cashier

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "PT Sumber Pangan",
      "contact_person": "Andi Wijaya",
      "phone": "021-5551111",
      "email": "andi@sumberpangan.co.id",
      "address": "Jl. Industri No. 50, Jakarta Utara",
      "is_active": true,
      "created_at": "2026-01-20T08:00:00Z",
      "updated_at": "2026-01-20T08:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/suppliers/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the supplier object.

---

### `POST /api/v1/suppliers`

> **Roles:** admin, manager, cashier

**Request Body:**
```json
{
  "name": "CV Segar Selalu",
  "contact_person": "Dewi Lestari",
  "phone": "021-5552222",
  "email": "dewi@segarselalu.com",
  "address": "Jl. Pasar Baru No. 12"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | max 100 chars |
| `contact_person` | string | ❌ | max 100 chars |
| `phone` | string | ❌ | max 20 chars |
| `email` | string | ❌ | valid email, max 255 chars |
| `address` | string | ❌ | — |

**Response `201 Created`:** Returns the created supplier object.

---

### `PUT /api/v1/suppliers/:id`

> **Roles:** admin, manager, cashier

**Response `200 OK`:** Returns the updated supplier object.

---

## 23. Purchases

### `GET /api/v1/purchases`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `supplier_id` | int | Filter by supplier |
| `branch_id` | int | Filter by branch |
| `status` | string | `ordered`, `partial_received`, `received`, `cancelled` |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "purchase_number": "PO-20260301-0001",
      "supplier_id": 1,
      "branch_id": 1,
      "ordered_by": 1,
      "received_by": 1,
      "subtotal": 2500000.00,
      "tax_amount": 275000.00,
      "total": 2775000.00,
      "paid_amount": 2775000.00,
      "status": "received",
      "notes": "Monthly rice order",
      "ordered_at": "2026-03-01T08:00:00Z",
      "received_at": "2026-03-02T10:00:00Z",
      "created_at": "2026-03-01T08:00:00Z",
      "updated_at": "2026-03-02T10:00:00Z",
      "supplier_name": "PT Sumber Pangan",
      "ordered_by_name": "John Admin",
      "received_by_name": "John Admin",
      "branch_name": "Tempest Cafe - Sudirman"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/purchases/:id`

> **Roles:** admin, manager, cashier

Get purchase with nested items.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "purchase_number": "PO-20260301-0001",
    "supplier_id": 1,
    "branch_id": 1,
    "ordered_by": 1,
    "received_by": 1,
    "subtotal": 2500000.00,
    "tax_amount": 275000.00,
    "total": 2775000.00,
    "paid_amount": 0.00,
    "status": "received",
    "notes": "Monthly rice order",
    "ordered_at": "2026-03-01T08:00:00Z",
    "received_at": "2026-03-02T10:00:00Z",
    "created_at": "2026-03-01T08:00:00Z",
    "updated_at": "2026-03-02T10:00:00Z",
    "supplier_name": "PT Sumber Pangan",
    "ordered_by_name": "John Admin",
    "received_by_name": "John Admin",
    "branch_name": "Tempest Cafe - Sudirman",
    "items": [
      {
        "id": 1,
        "purchase_id": 1,
        "inventory_id": 5,
        "quantity": 50.000,
        "unit_of_measure": "kg",
        "cost_per_unit": 50000.00,
        "total": 2500000.00,
        "inventory_name": "Rice"
      }
    ]
  }
}
```

---

### `POST /api/v1/purchases`

> **Roles:** admin, manager, cashier

Create a purchase order for raw ingredients. `ordered_by` is set from authenticated user.

**Request Body:**
```json
{
  "supplier_id": 1,
  "branch_id": 1,
  "notes": "Weekly ingredient restock",
  "tax_amount": 110000.00,
  "items": [
    {
      "inventory_id": 5,
      "quantity": 20.000,
      "unit_of_measure": "kg",
      "cost_per_unit": 12000.00
    },
    {
      "inventory_id": 8,
      "quantity": 10.000,
      "unit_of_measure": "kg",
      "cost_per_unit": 45000.00
    }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `supplier_id` | int | ✅ | must exist and be active |
| `branch_id` | int | ✅ | must exist |
| `notes` | string | ❌ | — |
| `tax_amount` | float | ❌ | >= 0 |
| `items` | array | ✅ | at least 1 item |
| `items[].inventory_id` | int | ✅ | must exist — references a raw ingredient inventory record |
| `items[].quantity` | float | ✅ | > 0 |
| `items[].unit_of_measure` | string | ✅ | `piece`, `kg`, `gram`, `ons`, `liter`, `ml`, `portion` |
| `items[].cost_per_unit` | float | ✅ | > 0 |

> **Changed:** `items[].menu_item_id` → `items[].inventory_id` (now references an inventory/ingredient, not a menu item)

**Response `201 Created`:** Returns the created purchase with items.

---

### `POST /api/v1/purchases/:id/receive`

> **Roles:** admin, manager, cashier

Record a payment against a purchase order.Supports full or partial payment in installments.

**On the first payment**, all goods are added to inventory (stock is adjusted for every item at full ordered quantity). Subsequent payments only update the paid amount — no further inventory changes occur.

**Request Body:**
```json
{
  "paid_amount": 1387500.00,
  "notes": "First installment — 50% paid"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `paid_amount` | float | ✅ | > 0; cannot exceed remaining unpaid amount (`total - paid_amount`) |
| `notes` | string | ❌ | — |

**Auto-status logic:**
- `paid_amount + new payment >= total` → status = `received`, `received_at` is stamped
- `paid_amount + new payment < total` → status = `partial_received`, `received_at` is **not** set yet

**Side effects (first payment only):** For each purchase item, the raw ingredient's `stock_quantity` is increased by the full ordered quantity and an `inventory_movements` record of type `purchase_in` is created.

**Response `200 OK`:** Returns the updated purchase object with the new `paid_amount` and `status`.

**Error `400`:**
- `"purchase status must be ordered or partial_received"` — already fully received or cancelled
- `"paid amount exceeds remaining balance of X"` — overpayment attempt
- `"paid_amount must be greater than 0"`

**Error `500`:** `"failed to receive item (inventory_id=X)"` — inventory adjustment failed (only possible on first payment).

---

### `PATCH /api/v1/purchases/:id/cancel`

> **Roles:** admin, manager, cashier

Cancel a purchase order. Cannot cancel if already received.

**Response `200 OK`:** Returns the updated purchase object.

**Error `400`:** `"cannot cancel a received purchase"`

---

## 24. Audit Logs (Read-Only)

### `GET /api/v1/audit-logs`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | int | Filter by user |
| `branch_id` | int | Filter by branch |
| `action` | string | `INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `VOID`, `REFUND`, `PRINT`, `OPEN_DRAWER`, `OVERRIDE`, `STATUS_CHANGE` |
| `table_name` | string | DB table name: `orders`, `users`, `menu_items`, etc. |
| `record_id` | int | Filter by affected record ID |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "branch_id": 1,
      "action": "INSERT",
      "table_name": "branches",
      "record_id": 3,
      "old_values": null,
      "new_values": {
        "id": 3,
        "name": "Tempest Cafe - PIK",
        "currency": "IDR"
      },
      "description": "Created branch: Tempest Cafe - PIK",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 ...",
      "session_id": "sess_abc123",
      "created_at": "2026-03-03T14:00:00Z",
      "user_name": "John Admin"
    },
    {
      "id": 2,
      "user_id": 1,
      "branch_id": 1,
      "action": "UPDATE",
      "table_name": "menu_items",
      "record_id": 1,
      "old_values": {
        "price": 42000.00
      },
      "new_values": {
        "price": 45000.00
      },
      "description": "Updated menu item price: Nasi Goreng Spesial",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 ...",
      "session_id": "sess_abc123",
      "created_at": "2026-03-03T14:15:00Z",
      "user_name": "John Admin"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### `GET /api/v1/audit-logs/record/:table/:recordId`

> **Roles:** admin, manager, cashier

Get the full change history for a specific record.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name (e.g., `menu_items`, `users`, `orders`) |
| `recordId` | int | The record's primary key |

**Example:** `GET /api/v1/audit-logs/record/menu_items/1`

**Response `200 OK`:** Same shape as the audit log list, filtered to that specific record.

---

## 25. Statistics

### `GET /api/v1/statistics/dashboard`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch (required) |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "today_revenue": 4250000.00,
    "yesterday_revenue": 3800000.00,
    "revenue_change_pct": 11.84,
    "today_orders": 62,
    "yesterday_orders": 55,
    "orders_change_pct": 12.73,
    "avg_order_value": 68548.39,
    "today_expenses": 350000.00,
    "yesterday_expenses": 280000.00,
    "today_net_cash": 3900000.00,
    "active_tables": 8,
    "open_shifts": 2,
    "low_stock_items": 3,
    "pending_reservations": 5
  }
}
```

> **Note:** `today_expenses` and `yesterday_expenses` include both `cash_out` shift transactions **and** purchase orders with `status = "received"` on that date. Only fully received POs are counted — `ordered`, `partial_received`, and `cancelled` are excluded.

---

### `GET /api/v1/statistics/sales`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `branch_id` | int | — | Filter by branch |
| `date_from` | string | 30 days ago | Start date `YYYY-MM-DD` |
| `date_to` | string | today | End date `YYYY-MM-DD` |
| `group_by` | string | `day` | `day`, `week`, or `month` |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "period": "2026-03-01",
      "total_revenue": 3500000.00,
      "total_orders": 48,
      "total_tax": 385000.00,
      "total_discount": 125000.00,
      "net_revenue": 2990000.00,
      "total_expenses": 250000.00,
      "net_profit": 2740000.00
    },
    {
      "period": "2026-03-02",
      "total_revenue": 3800000.00,
      "total_orders": 55,
      "total_tax": 418000.00,
      "total_discount": 150000.00,
      "net_revenue": 3232000.00,
      "total_expenses": 180000.00,
      "net_profit": 3052000.00
    },
    {
      "period": "2026-03-03",
      "total_revenue": 4250000.00,
      "total_orders": 62,
      "total_tax": 467500.00,
      "total_discount": 200000.00,
      "net_revenue": 3582500.00,
      "total_expenses": 320000.00,
      "net_profit": 3262500.00
    }
  ]
}
```

> **Note:** `total_expenses` = sum of `cash_out` shift transactions + received purchase orders (`status = "received"`) in the period, grouped by the same period bucket. `net_profit` = `net_revenue - total_expenses`.

---

### `GET /api/v1/statistics/revenue-by-category`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "category_id": 3,
      "category_name": "Main Course",
      "total_revenue": 2850000.00,
      "order_count": 95,
      "items_sold": 142.000
    },
    {
      "category_id": 4,
      "category_name": "Beverages",
      "total_revenue": 1200000.00,
      "order_count": 180,
      "items_sold": 245.000
    },
    {
      "category_id": 2,
      "category_name": "Appetizers",
      "total_revenue": 600000.00,
      "order_count": 40,
      "items_sold": 55.000
    }
  ]
}
```

---

### `GET /api/v1/statistics/top-items`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `branch_id` | int | — | Filter by branch |
| `date_from` | string | — | Start date `YYYY-MM-DD` |
| `date_to` | string | — | End date `YYYY-MM-DD` |
| `limit` | int | 10 | Max 50 |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "menu_item_id": 1,
      "menu_item_name": "Nasi Goreng Spesial",
      "quantity_sold": 142.000,
      "total_revenue": 6390000.00,
      "order_count": 95
    },
    {
      "menu_item_id": 5,
      "menu_item_name": "Es Teh Manis",
      "quantity_sold": 245.000,
      "total_revenue": 3675000.00,
      "order_count": 180
    },
    {
      "menu_item_id": 3,
      "menu_item_name": "Mie Goreng",
      "quantity_sold": 88.000,
      "total_revenue": 3080000.00,
      "order_count": 65
    }
  ]
}
```

---

### `GET /api/v1/statistics/payment-methods`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "payment_method": "cash",
      "count": 150,
      "total_amount": 5250000.00,
      "percentage": 45.22
    },
    {
      "payment_method": "qris",
      "count": 80,
      "total_amount": 3200000.00,
      "percentage": 27.56
    },
    {
      "payment_method": "debit_card",
      "count": 40,
      "total_amount": 1800000.00,
      "percentage": 15.50
    },
    {
      "payment_method": "ewallet",
      "count": 25,
      "total_amount": 950000.00,
      "percentage": 8.18
    },
    {
      "payment_method": "credit_card",
      "count": 10,
      "total_amount": 412000.00,
      "percentage": 3.55
    }
  ]
}
```

---

### `GET /api/v1/statistics/expense-breakdown`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "reason": "purchase_order",
      "total_amount": 1200000.00,
      "count": 3,
      "percentage": 40.00
    },
    {
      "reason": "supply_purchase",
      "total_amount": 850000.00,
      "count": 12,
      "percentage": 28.33
    },
    {
      "reason": "owner_withdrawal",
      "total_amount": 500000.00,
      "count": 5,
      "percentage": 16.67
    },
    {
      "reason": "petty_cash",
      "total_amount": 350000.00,
      "count": 18,
      "percentage": 11.67
    },
    {
      "reason": "staff_advance",
      "total_amount": 100000.00,
      "count": 2,
      "percentage": 3.33
    }
  ]
}
```

**Description:** Returns a breakdown of all expenses grouped by reason. Includes both `cash_out` shift transactions (grouped by their `reason` enum) and received purchase orders (surfaced as `reason = "purchase_order"`). Percentages are relative to the combined total.

**Reason values:**

| Value | Source |
|-------|--------|
| `purchase_order` | Purchase orders with `status = "received"` |
| `supply_purchase` | Manual cash-out: ad-hoc supply buy |
| `owner_withdrawal` | Manual cash-out: owner withdrawal |
| `staff_advance` | Manual cash-out: staff advance |
| `petty_cash` | Manual cash-out: petty cash |
| `tip_out` | Manual cash-out: tip distribution |
| `cash_deposit` | Manual cash-out: cash deposit |
| `change_refill` | Manual cash-out: change refill |
| `other` | Manual cash-out: other |

---

### `GET /api/v1/statistics/cash-flow`

> **Roles:** admin, manager, cashier

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | int | Filter by branch |
| `date_from` | string | Start date `YYYY-MM-DD` |
| `date_to` | string | End date `YYYY-MM-DD` |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-03-01",
      "cash_in": 1800000.00,
      "cash_out": 350000.00,
      "shift_cash_in": 100000.00,
      "shift_cash_out": 250000.00,
      "po_expenses": 450000.00,
      "net_cash": 850000.00,
      "non_cash_in": 1700000.00,
      "total_revenue": 3500000.00,
      "total_expenses": 700000.00
    },
    {
      "date": "2026-03-02",
      "cash_in": 2000000.00,
      "cash_out": 420000.00,
      "shift_cash_in": 50000.00,
      "shift_cash_out": 180000.00,
      "po_expenses": 0.00,
      "net_cash": 1450000.00,
      "non_cash_in": 1800000.00,
      "total_revenue": 3800000.00,
      "total_expenses": 180000.00
    }
  ]
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| `cash_in` | Cash payments received from orders |
| `cash_out` | Change given from orders |
| `shift_cash_in` | Non-order cash deposits (`cash_in` shift transactions) |
| `shift_cash_out` | Non-order cash withdrawals/expenses (`cash_out` shift transactions) |
| `po_expenses` | Total of purchase orders with `status = "received"` on this date |
| `net_cash` | `(cash_in − cash_out) + (shift_cash_in − shift_cash_out) − po_expenses` |
| `non_cash_in` | Non-cash payments (card, e-wallet, QRIS) |
| `total_revenue` | Gross revenue from all completed orders |
| `total_expenses` | `shift_cash_out + po_expenses` |

---

### `GET /api/v1/statistics/shifts/:id`

> **Roles:** admin, manager, cashier

Get a detailed financial report for a specific shift.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "shift": {
      "id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
      "user_id": 2,
      "device_id": "550e8400-e29b-41d4-a716-446655440000",
      "branch_id": 1,
      "status": "closed",
      "opening_cash": 500000.00,
      "closing_cash": 1850000.00,
      "expected_cash": 1830000.00,
      "cash_difference": 20000.00,
      "opened_at": "2026-03-03T07:00:00Z",
      "closed_at": "2026-03-03T15:00:00Z",
      "notes": "Everything balanced",
      "user_name": "Sarah Cashier",
      "device_name": "Kasir 1",
      "branch_name": "Tempest Cafe - Sudirman"
    },
    "total_orders": 45,
    "completed_orders": 42,
    "cancelled_orders": 2,
    "voided_orders": 1,
    "gross_revenue": 6750000.00,
    "total_discounts": 250000.00,
    "total_tax": 742500.00,
    "total_service_charge": 337500.00,
    "net_revenue": 5420000.00,
    "total_cash_in": 150000.00,
    "total_cash_out": 320000.00,
    "total_po_expenses": 600000.00,
    "net_cash_movement": -770000.00,
    "payment_breakdown": [
      {
        "payment_method": "cash",
        "count": 25,
        "total_amount": 3500000.00,
        "percentage": 51.85
      },
      {
        "payment_method": "qris",
        "count": 12,
        "total_amount": 2000000.00,
        "percentage": 29.63
      },
      {
        "payment_method": "debit_card",
        "count": 8,
        "total_amount": 1250000.00,
        "percentage": 18.52
      }
    ],
    "cash_transactions": [
      {
        "id": "a1c2e3d4-5678-49ab-9cde-0123456789ab",
        "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
        "user_id": 2,
        "type": "cash_in",
        "reason": "change_refill",
        "amount": 150000.00,
        "note": "Added coins for change",
        "created_at": "2026-03-03T09:30:00Z",
        "user_name": "Sarah Cashier"
      },
      {
        "id": "b2d3f4e5-6789-4abc-8def-112233445566",
        "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
        "user_id": 2,
        "type": "cash_out",
        "reason": "supply_purchase",
        "amount": 200000.00,
        "note": "Bought vegetables from market",
        "created_at": "2026-03-03T11:00:00Z",
        "user_name": "Sarah Cashier"
      },
      {
        "id": "c3e4f506-789a-4bcd-9ef0-223344556677",
        "shift_id": "9b1f0d8c-1b2a-4e3f-8c6d-1234567890ab",
        "user_id": 2,
        "type": "cash_out",
        "reason": "petty_cash",
        "amount": 120000.00,
        "note": "Office supplies",
        "created_at": "2026-03-03T13:00:00Z",
        "user_name": "Sarah Cashier"
      }
    ],
    "po_expenses": [
      {
        "id": 7,
        "purchase_number": "PO-20260303-0007",
        "supplier_id": 2,
        "branch_id": 1,
        "ordered_by": 3,
        "received_by": 2,
        "subtotal": 545454.55,
        "tax_amount": 54545.45,
        "total": 600000.00,
        "status": "received",
        "notes": null,
        "ordered_at": "2026-03-03T06:00:00Z",
        "received_at": "2026-03-03T10:15:00Z",
        "created_at": "2026-03-03T06:00:00Z",
        "updated_at": "2026-03-03T10:15:00Z",
        "supplier_name": "CV Sumber Bahan",
        "ordered_by_name": "Budi Manager",
        "received_by_name": "Sarah Cashier",
        "branch_name": "Tempest Cafe - Sudirman"
      }
    ]
  }
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| `total_cash_in` | Sum of all `cash_in` shift transactions during this shift |
| `total_cash_out` | Sum of all `cash_out` shift transactions during this shift |
| `total_po_expenses` | Sum of received POs whose `received_at` falls within the shift window |
| `net_cash_movement` | `total_cash_in − total_cash_out − total_po_expenses` |
| `po_expenses` | List of purchase orders received during this shift (omitted if none) |

> **Shift window for POs:** `received_at >= shift.opened_at AND received_at < shift.closed_at` (or `NOW()` for open shifts).

---

## 26. Enum Reference

### Role Types
| Value | Description |
|-------|-------------|
| `admin` | Full system access |
| `manager` | Branch management |
| `cashier` | Point-of-sale operations |
| `chef` | Kitchen operations |
| `waiter` | Table service |

### Pricing Type
| Value | Description |
|-------|-------------|
| `fixed` | Fixed price per unit (e.g., per portion) |
| `weight_based` | Price per weight unit (e.g., per gram/kg) |

### Unit of Measure
| Value | Description |
|-------|-------------|
| `piece` | Individual piece |
| `kg` | Kilogram |
| `gram` | Gram |
| `ons` | Ons (100g) |
| `liter` | Liter |
| `ml` | Milliliter |
| `portion` | Standard portion |

### Order Type
| Value | Description |
|-------|-------------|
| `dine_in` | Dine-in order |
| `takeaway` | Takeaway order |

### Order Status
| Value | Description |
|-------|-------------|
| `pending` | Order placed, not yet confirmed |
| `confirmed` | Confirmed by staff |
| `preparing` | Kitchen is preparing |
| `ready` | Ready for pickup/serving |
| `served` | Served to customer |
| `completed` | Completed and paid |
| `cancelled` | Cancelled |

### Payment Method
| Value | Description |
|-------|-------------|
| `cash` | Cash payment |
| `debit_card` | Debit card |
| `credit_card` | Credit card |
| `ewallet` | E-wallet (OVO, GoPay, etc.) |
| `qris` | QRIS QR code |
| `bank_transfer` | Bank transfer |

### Payment Status
| Value | Description |
|-------|-------------|
| `unpaid` | No payment received |
| `partial` | Partially paid |
| `paid` | Fully paid |
| `refunded` | Payment refunded |

### Table Status
| Value | Description |
|-------|-------------|
| `available` | Table is free |
| `occupied` | Table has seated guests |
| `reserved` | Table is reserved |
| `maintenance` | Table is out of service |

### Shift Status
| Value | Description |
|-------|-------------|
| `open` | Shift is currently active |
| `closed` | Shift has been closed |

### Device Status
| Value | Description |
|-------|-------------|
| `active` | Device is active |
| `inactive` | Device is deactivated |

### Discount Type
| Value | Description |
|-------|-------------|
| `percentage` | Percentage discount (e.g., 10%) |
| `fixed_amount` | Fixed amount discount (e.g., Rp 25.000) |

### Purchase Status
| Value | Description |
|-------|-------------|
| `ordered` | Purchase order placed, no goods received yet |
| `partial_received` | Partially paid; goods received into inventory on first payment; further payments allowed |
| `received` | All ordered quantities have been fully received |
| `cancelled` | Purchase cancelled |

### Reservation Status
| Value | Description |
|-------|-------------|
| `confirmed` | Reservation confirmed |
| `seated` | Guest has been seated |
| `completed` | Reservation completed |
| `no_show` | Guest did not show up |
| `cancelled` | Reservation cancelled |

### Audit Action
| Value | Description |
|-------|-------------|
| `INSERT` | Record created |
| `UPDATE` | Record updated |
| `DELETE` | Record deleted/deactivated |
| `LOGIN` | User logged in |
| `LOGOUT` | User logged out |
| `VOID` | Order/item voided |
| `REFUND` | Payment refunded |
| `PRINT` | Receipt printed |
| `OPEN_DRAWER` | Cash drawer opened |
| `OVERRIDE` | Manager override |
| `STATUS_CHANGE` | Status changed |

### Inventory Movement Type
| Value | Description |
|-------|-------------|
| `purchase_in` | Stock received from purchase |
| `sale_out` | Stock deducted from order |
| `adjustment` | Manual stock adjustment |
| `waste` | Stock written off as waste |
| `transfer` | Stock transferred between branches |

### Cash Transaction Type
| Value | Description |
|-------|-------------|
| `cash_in` | Cash added to the drawer (non-order) |
| `cash_out` | Cash removed from the drawer (non-order) |

### Cash Transaction Reason
| Value | Description |
|-------|-------------|
| `owner_withdrawal` | Owner withdrawing cash from drawer |
| `supply_purchase` | Cash paid out for a supply/vendor purchase |
| `staff_advance` | Cash advance given to a staff member |
| `petty_cash` | Petty cash disbursement |
| `tip_out` | Tip payout to staff |
| `cash_deposit` | Cash deposited into drawer |
| `change_refill` | Adding coins/notes for making change |
| `other` | Other reason (use `note` field for details) |
