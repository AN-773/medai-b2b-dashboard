# Promo Codes API Contract (IAM service)

Superadmin-managed promo codes that grant free pro days when redeemed by an app
user. Served by **weos-iam-service** (`VITE_IAM_API_URL`). All admin endpoints
require a superadmin JWT; the backend re-verifies the role server-side.

Backend entity `id` fields are absolute URLs; the last path segment is the
identifier. The `code` value (uppercase) is the natural key used for updates.

## Entity: PromoCode

```json
{
  "id": "https://iam.example.com/v1/promo-codes/2h9X...",
  "code": "WELCOME-30",
  "freeDays": 30,
  "maxRedemptions": 100,
  "redemptionCount": 12,
  "expiresAt": "2026-12-31T23:59:59Z",
  "active": true,
  "createdBy": "https://iam.example.com/v1/users/...",
  "created": "2026-07-23T10:00:00Z",
  "updated": "2026-07-23T10:00:00Z"
}
```

- `maxRedemptions: 0` = unlimited redemptions.
- `expiresAt: null` = the code never expires.
- Codes are normalized to uppercase server-side; 3–32 chars of `A-Z 0-9 - _`.

## GET /promo-codes (superadmin)

Query params: `page` (default 1), `limit`, `q` (matches code substring).

Response `200`:

```json
{ "total": 42, "page": 1, "items": [PromoCode, ...] }
```

## POST /promo-codes (superadmin)

Request body:

```json
{
  "code": "WELCOME-30",        // required
  "freeDays": 30,               // required, 1–3650
  "maxRedemptions": 100,        // optional, 0/omitted = unlimited
  "expiresAt": "2026-12-31T23:59:59Z" // optional RFC3339, must be future
}
```

Responses: `201` with the created `PromoCode`; `400` validation error;
`409` duplicate code. Error body: `{ "message": "..." }`.

## PUT /promo-codes (superadmin)

Partial update keyed by `code`. Only provided fields change.

```json
{
  "code": "WELCOME-30",        // required — identifies the promo code
  "active": false,              // optional — deactivate/reactivate
  "freeDays": 20,               // optional
  "maxRedemptions": 50,         // optional
  "expiresAt": ""              // optional — RFC3339, or "" to clear expiry
}
```

Responses: `200` with the updated `PromoCode`; `404` unknown code.

## POST /promo-codes/redeem (authenticated app user — not used by this dashboard)

`{ "code": "WELCOME-30" }` → `200 { "freeDays": 30, "expires": "..." }`.
Grants an `active` subscription with plan `promo` on the caller's account
(local only — never synced to RevenueCat). Errors: `404` unknown code,
`410` inactive/expired/exhausted, `409` already redeemed by this account or
the account has an active paid subscription.
