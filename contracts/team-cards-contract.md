# Team Contact Cards API Contract (IAM service)

Superadmin-managed public contact cards. Each team member gets a card at
`/team/<slug>` on the public Nuxt app, reached **only** by scanning that person's
QR code — cards are never linked from the site and are excluded from search
engines. Served by **weos-iam-service** (`VITE_IAM_API_URL`).

Admin endpoints require a superadmin JWT and the backend re-verifies the role
server-side. The three `/team/{slug}*` read endpoints are deliberately
unauthenticated (`security: []` in `api.yaml`) — the audience is people outside
the platform holding a business card.

## Photo storage

IAM has no object storage, so photos are stored base64 in Postgres. Two rules
follow from that:

- The **card JSON never inlines the base64.** It returns `photoUrl`, pointing at a
  separate endpoint that serves the decoded bytes. A QR scan on mobile data
  fetches a few hundred bytes of JSON, not a padded image.
- `photoUrl` carries a content hash in `?v=`, so a given URL is immutable and
  cacheable for a day. Replacing the photo changes the hash and the URL.

The dashboard compresses to 512px / 0.25MB before encoding; the backend rejects
anything over **512KB decoded** and any mime outside PNG / JPEG / WEBP.

## Entity: TeamMember (superadmin shape)

```json
{
  "id": "https://iam.example.com/v1/team-members/2h9X...",
  "slug": "jane-doe",
  "name": "Jane Doe",
  "jobTitle": "Head of Clinical Content",
  "department": "Clinical",
  "company": "Medical Student AI",
  "bio": "Short paragraph shown under the name.",
  "email": "jane@medicalstudent.ai",
  "phone": "+1 555 010 0100",
  "linkedinUrl": "https://linkedin.com/in/janedoe",
  "twitterUrl": "https://x.com/janedoe",
  "websiteUrl": "https://medicalstudent.ai",
  "schedulingUrl": "https://cal.com/janedoe",
  "hasPhoto": true,
  "photoUrl": "https://iam.example.com/v1/team/jane-doe/photo?v=9f2c1a4b7e03",
  "active": true,
  "sortOrder": 0,
  "createdBy": "https://iam.example.com/v1/users/...",
  "created": "2026-08-13T10:00:00Z",
  "updated": "2026-08-13T10:00:00Z"
}
```

- `slug` is 1–64 chars of `a-z 0-9 -`, derived from `name` when omitted on create.
  It **cannot be changed after creation** — printed QR codes already point at it.
- `photoUrl` is `null` when no photo is set.
- `active: false` takes the card offline: public endpoints 404 as if the person
  does not exist. Prefer this over `DELETE` once a code is in circulation.
- All four URL fields must be `http(s)` — the backend rejects `javascript:`,
  `data:`, and schemeless values, because they land in `href` attributes.

## GET /team-members (superadmin)

Query params: `page` (default 1), `limit`, `q` (matches name, slug or email).
Ordered by `sortOrder` then `name`. Includes deactivated members.

Response `200`:

```json
{ "total": 12, "page": 1, "items": [TeamMember, ...] }
```

## POST /team-members (superadmin)

```json
{
  "name": "Jane Doe",              // required, <= 200 chars
  "slug": "jane-doe",              // optional, derived from name when omitted
  "jobTitle": "...",               // all optional, <= 200 chars each
  "department": "...",
  "company": "...",
  "bio": "...",                    // <= 600 chars
  "email": "...",
  "phone": "...",
  "linkedinUrl": "https://...",    // must be http(s) when present
  "twitterUrl": "https://...",
  "websiteUrl": "https://...",
  "schedulingUrl": "https://...",
  "photo": "data:image/png;base64,....",  // <= 512KB decoded
  "sortOrder": 0
}
```

Responses: `201` with the created `TeamMember`; `400` validation error;
`409` duplicate slug. Error body: `{ "message": "..." }`.

## PUT /team-members (superadmin)

Partial update keyed by `slug`. Only supplied fields change.

- Omit `photo` to leave the existing image alone.
- Send `"photo": ""` to remove it.
- Send `"active": false` to take the card offline.

Responses: `200` with the updated `TeamMember`; `400`; `404` unknown slug.

## DELETE /team-members/{slug} (superadmin)

Permanently deletes the row and its photo. Responses: `204`; `404`.

## GET /team/{slug} — public, no auth

The payload a scanned QR code ultimately renders. Omits `createdBy`, `sortOrder`,
`active`, and the photo bytes.

```json
{
  "slug": "jane-doe",
  "name": "Jane Doe",
  "jobTitle": "Head of Clinical Content",
  "department": "Clinical",
  "company": "Medical Student AI",
  "bio": "...",
  "email": "jane@medicalstudent.ai",
  "phone": "+1 555 010 0100",
  "linkedinUrl": "https://linkedin.com/in/janedoe",
  "twitterUrl": "https://x.com/janedoe",
  "websiteUrl": "https://medicalstudent.ai",
  "schedulingUrl": "https://cal.com/janedoe",
  "photoUrl": "https://iam.example.com/v1/team/jane-doe/photo?v=9f2c1a4b7e03",
  "vcardUrl": "https://iam.example.com/v1/team/jane-doe/vcard"
}
```

`Cache-Control: public, max-age=300`. Unknown or deactivated slug → `404`.

## GET /team/{slug}/photo — public, no auth

Decoded avatar bytes with the stored mime type. Sends an `ETag` (the content hash)
and honours `If-None-Match` with `304`. `Cache-Control: public, max-age=86400`.
`404` when the member is missing, deactivated, or has no photo.

## GET /team/{slug}/vcard — public, no auth

vCard 3.0 download for the card's "Save contact" button, served as
`text/vcard; charset=utf-8` with `Content-Disposition: attachment`.

Generated server-side on purpose: most scans land in mobile Safari, which handles
a real `text/vcard` response with a filename far more reliably than a
client-constructed `Blob` download. Version 3.0 rather than 4.0 because it is what
iOS Contacts, Android, Google Contacts and Outlook all import cleanly. The photo
is embedded inline (`PHOTO;ENCODING=b`) so the saved contact keeps the picture,
and lines are RFC 2425 folded on rune boundaries so multi-byte names survive.

## Dashboard configuration

`VITE_PUBLIC_APP_URL` — the public Nuxt app origin the QR codes point at
(default `https://medicalstudent.ai`). This cannot be derived from the API base
URLs, since the card lives on the marketing app rather than any service.
