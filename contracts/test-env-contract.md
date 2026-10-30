# Test Environment Switch API Contract

Lets a superadmin see the test environment and start it from the dashboard.
Served by `medai-test-env-api` (`infra/aws/test-switch`, a Lambda function URL),
set per site in `VITE_TEST_ENV_API_URL`. The value is `terraform output api_url`
in that stack. Unset, the page says it is not connected.

This API runs outside the test environment, because it has to answer while the
test environment sleeps. It reads tokens from either identity: a token from
production IAM (university.medicalstudent.ai) or from TEST IAM
(dashboard.medicalstudent.ai).

**There is no way to stop the test environment here, by design.** It turns itself
off after 30 minutes without use, and engineers can stop it with
`infra/aws/test-switch/test-env.sh`.

## Auth

Every route requires `Authorization: Bearer <token>` holding the `superadmin`
role. The API verifies the signature, issuer, audience, expiry and role itself.

Refusals use the agent-v2 envelope, `{ "error": { "code", "message" } }`:

| Status | `code` | Meaning |
|--------|--------|---------|
| 401 | `not_signed_in` | No token, or one that does not verify |
| 403 | `superadmin_required` | A valid token without the role |
| 404 | `not_found` | Any other method or path |
| 502 | `switch_failed` | The switch failed. Needs an engineer |
| 503 | `switch_busy` | The switch stayed busy. Try again |
| 503 | `identity_unavailable` | The keys could not be read. Try again |

A 401 here does not sign anyone out of the dashboard: `TEST_ENV` is not one of the
session-owning services in `services/apiClient.ts`.

## Entity: TestEnvStatus

```json
{
  "state": "awake",
  "since": "2026-10-30T11:50:00Z",
  "ready": false,
  "startedBy": "sam@medicalstudent.ai",
  "databases": { "ready": 4, "total": 4 },
  "services": { "ready": 21, "total": 24 },
  "idleMinutes": 2,
  "sleepsAfterIdleMinutes": 30,
  "keepAwakeUntil": "2026-10-30T12:20:00Z"
}
```

- `state`: `asleep` → `waking` → `awake` → `sleeping` → `asleep`.
- `since`: when `state` began. It resets at each state, so it is not the time of
  the start.
- `ready`: `awake` with every service running. This is what "the test environment
  works" means, not `state` alone.
- `startedBy`: the email of whoever last started it, or null when the last change
  was something else (it went idle).
- `databases`, `services`: progress. `services.total` is 0 until the databases are
  up and the services are asked to run.
- `idleMinutes`, `sleepsAfterIdleMinutes`: only while `awake`, otherwise null.
- `keepAwakeUntil`: the earliest it may turn itself off, or null.

## GET /status

Returns `TestEnvStatus`. While `state` is `waking`, this also nudges the wake
along, so the page reaches `ready` sooner while someone is watching. An open page
does not count as use and does not keep the environment awake.

## POST /start

No body; any body is ignored. Returns `TestEnvStatus`.

Wakes the environment and keeps it up for at least 30 minutes. Safe to repeat:
starting something already on only extends that. The caller's email comes from the
token and is recorded by the switch.
