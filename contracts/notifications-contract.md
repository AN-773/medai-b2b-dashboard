# Notification Service API Contract

Superadmin tools for **medai-notification-service** (`VITE_NOTIFICATIONS_API_URL`),
the service that fans notifications out to email (Azure Communication Service),
push (FCM) and Microsoft Teams. Consumed by `services/notificationService.ts`
and the `Notifications` view.

The service's own OpenAPI spec is the source of truth:
`medai-notification-service/api.yaml`.

## Authentication

The service accepts **two** credentials on every authenticated route:

| Credential | Header | Used by |
|---|---|---|
| Shared API key | `X-Notify-Key` | Other medai services (Go `client` SDK) |
| IAM bearer token | `Authorization: Bearer …` | This dashboard |

The dashboard sends the operator's own IAM token — `apiClient` injects it
automatically. **The shared key must never appear in this bundle**: it is a
service credential that authorises sending arbitrary email and push as medai,
and anything in a browser bundle is public.

The service verifies the token against IAM's JWKS and requires the role claim
(`https://iam.weos.io/v1/roles`) to be listed in `NOTIFY_ADMIN_ROLES`
(default `superadmin`). Presenting a bearer token never falls back to key auth:
a rejected token is a 401 even alongside a valid `X-Notify-Key`.

### Service-side configuration required

| Env var | Purpose |
|---|---|
| `NOTIFY_JWKS_URL` | IAM JWKS, e.g. `https://<iam-host>/oauth2/certs`. Unset ⇒ bearer auth off ⇒ these tools return 401. |
| `NOTIFY_ADMIN_ROLES` | Comma-separated roles allowed. Default `superadmin`. |
| `NOTIFY_CORS_ORIGINS` | Comma-separated browser origins, matched as exact strings. Unset ⇒ every call is blocked by CORS. |
| `NOTIFY_JWT_ISSUER` | Optional. Pins the accepted `iss` claim. |

A 401 from this service does **not** end the dashboard session — `apiClient`
excludes `NOTIFICATIONS` from its global logout-on-401, because a rejection
here usually means the service is misconfigured, not that the operator's IAM
session expired.

### Origins that must be allowlisted

The dashboard answers on four production origins — each custom domain plus the
Azure Static Web Apps default hostname behind it — and all four are distinct
browser Origins:

```
http://localhost:5173
https://university.medicalstudent.ai
https://icy-moss-06fa7900f.7.azurestaticapps.net
https://dashboard.medicalstudent.ai
https://blue-sky-077e8120f.2.azurestaticapps.net
```

A missing origin still gets a **204** preflight — just without
`Access-Control-Allow-Origin`. When debugging, assert on that header rather than
the status code, or a broken origin looks like a pass.

`.env` is git-tracked and the Static Web Apps workflows inject no `VITE_*`, so
`VITE_NOTIFICATIONS_API_URL` must be **committed** — otherwise the production
bundle bakes in the `http://localhost:8691` fallback and no CORS change helps.

### Running it locally

The notification service defaults to port **8691**, which `medai-test-service`
already occupies locally (`run-services.sh`). Run it elsewhere and match
`VITE_NOTIFICATIONS_API_URL`:

```bash
cd medai-notification-service && PORT=8694 NOTIFY_JWKS_URL=http://localhost:8683/oauth2/certs NOTIFY_CORS_ORIGINS=http://localhost:5173 go run ./cmd/notifier
```

The Overview tab's "Your access" row shows how the service resolved your
credential — the fastest way to tell a config problem from a role problem.

## Conventions

Endpoints under `/admin` were added for this dashboard and return a paginated
envelope:

```json
{ "items": [...], "total": 128, "limit": 50, "offset": 0 }
```

The pre-existing service-to-service endpoints keep their original bare-array
responses. `GET /suppressions` is the one hybrid: it still returns an array and
carries the unpaginated count in the `X-Total-Count` header (exposed via CORS).

`limit` defaults to 50 and is capped at 500. `window_hours` is capped at 2160
(90 days).

## Entities

```jsonc
// Template — Go text/template (html/template when format is "html")
{ "key": "user.invited", "channel": "email", "subject_tmpl": "...",
  "body_tmpl": "...", "format": "text", "version": 3,
  "updated_at": "2026-08-01T10:00:00Z" }

// TeamsWebhook — `url` embeds a secret; the UI masks it after saving
{ "key": "ops-alerts", "name": "...", "url": "https://outlook.office.com/webhook/...",
  "description": "...", "enabled": true, "created_at": "..." }

// SuppressedEmail — addresses medai will never email again
{ "id": "...", "email": "bounced@example.com", "reason": "Bounced: ...",
  "source": "smtp_permanent" | "acs_delivery_report" | "manual", "created_at": "..." }

// DeliveryLog — one row per send attempt, including retries
{ "id": "...", "notification_id": "...", "channel": "email", "recipient": "...",
  "status": "pending" | "sent" | "failed" | "skipped", "error": "...",
  "attempt": 1, "idempotency_key": "...", "created_at": "..." }

// DeviceToken — FCM registration
{ "id": "...", "user_id": "users/42", "token": "...",
  "platform": "ios" | "android" | "web", "last_seen": "...", "created_at": "..." }
```

`channel` is always one of `email`, `push`, `teams`.

## Endpoints

### `GET /admin/overview?window_hours=24`

Summary cards. Returns delivery stats over the window plus registry sizes:

```json
{
  "deliveries": { "since": "...", "total": 412,
                  "by_status": { "sent": 400, "failed": 12 },
                  "by_channel": { "email": 380, "push": 32 } },
  "channels": ["email", "teams"],
  "templates": 5, "webhooks": 2, "suppressions": 17,
  "device_tokens": 1204, "window_hours": 24
}
```

`channels` lists only channels with a **sender registered in the running
process**. A channel missing here is disabled by that deployment's env (no SMTP
credentials, no FCM config) — the overview surfaces this as "Disabled channels".

### `GET /admin/whoami`

Returns `{ auth_method, email, user_id }`. Used to confirm the service accepts
this operator's token without touching any data.

### `GET /admin/deliveries`

Browse the delivery log. Every filter optional: `notification_id` (exact),
`channel`, `status`, `recipient` (case-insensitive substring), `window_hours`,
`limit`, `offset`. Newest first. `400` on an unknown channel or status.

Distinct from `GET /deliveries?notification_id=…`, which services use to
inspect a single notification and which requires the ID.

### `GET /admin/device-tokens`

Browse FCM registrations. `user_id` (exact) scopes to one user; omit it to list
every token. Newest `last_seen` first.

### `POST /admin/templates/{key}/preview`

Renders without sending.

```jsonc
{ "channel": "email",
  "variables": { "firstName": "Alice" },
  // Optional draft overrides — preview an unsaved edit.
  "subject_tmpl": "...", "body_tmpl": "...", "format": "html" }
```

Returns `{ key, channel, subject, body, body_format, missing_variables }`.
`missing_variables` lists `{{.name}}` references the caller did not supply;
those render blank rather than failing. With **both** `subject_tmpl` and
`body_tmpl` supplied the template need not exist yet (`404` otherwise).

### `POST /admin/teams-webhooks/{key}/test`

Posts an adaptive card to the webhook. Body `{ "message": "..." }` optional.
`200 {"status":"sent"}`; `502 {"status":"failed","error":"..."}` when the
webhook is unknown, disabled, or rejects the post; `503` when the Teams channel
is not registered in the service.

### Pre-existing endpoints this view also uses

| Endpoint | Notes |
|---|---|
| `GET /templates` | Bare array. |
| `PUT /templates/{key}` | Body is a full Template. **Bump `version`** — the service re-seeds any row whose version is behind the shipped build's, so an edit at or below the seeded version is overwritten on the next restart. |
| `DELETE /templates/{key}?channel=…` | `channel` is required. Seeded templates return on restart. |
| `GET/PUT/DELETE /teams-webhooks[/{key}]` | Upsert takes a full TeamsWebhook. |
| `GET /suppressions?q=&limit=&offset=` | Array + `X-Total-Count`. |
| `PUT /suppressions/{email}` | Body `{ "reason": "..." }`. Idempotent. |
| `DELETE /suppressions/{email}` | Sending to that address resumes. |
| `DELETE /device-tokens/{token}` | The app re-registers on next launch. |
| `POST /notifications` | **Sends for real.** Backs the Send a Test tab; the UI confirms first. Returns `{ notification_id, per_channel, errors }`. |
| `GET /readyz` | Unauthenticated; also proves the host is reachable at all. |
