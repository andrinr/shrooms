# HTTP API

> Current release: saved spots use browser local storage with JSON import/export. Account endpoints are retired (HTTP 410). Account implementation details below document the preserved legacy system, not an available user feature.


All routes live under `/api` on the same origin as the frontend. Responses are JSON, errors use `{ "error": "message" }`. The API is version 1, reported by `/api/config`.

## Public reads

| Route | Response |
| --- | --- |
| `GET /api/health` | Application status and shared weather freshness |
| `GET /api/config` | Capabilities and available regions |
| `GET /api/species` | Species profiles and model parameters |
| `GET /api/weather?region=zh` | `{snapshot,status}`; never triggers visitor-specific upstream fetches |
| `GET /api/data/regions` | Region catalog |
| `GET /api/data/index` | Zürich property index |
| `GET /api/data/regions/be/index` | Bern property index |
| `GET /api/data/{tile-key}` | Allowlisted geometry from the index manifest |
| `GET /api/habitat?region=zh&species=porcini&bbox=8.50,47.25,8.51,47.26&limit=100&offset=0` | Paged cells and computed scores |

Region `ch` is the 500 m nationwide overview. Canton codes are lowercase, with 50 m detail in `zh` and 100 m elsewhere. Bboxes use west,south,east,north in WGS84, with a maximum span of one degree in either direction. Limits are 1–200; offsets are 0–1,000,000. Habitat responses include `total`, `offset`, `limit`, `species`, `date` and `cells`; geometries are separate tile downloads. Scores are unvalidated suitability values.

Data responses support gzip, ETag/If-None-Match, HEAD and a one-hour public cache. User and weather responses use `no-store`.

## Accounts

All writes require `Content-Type: application/json` and an `Origin` matching the website. The browser automatically sends the HttpOnly session cookie. Fetch `/api/auth/me` to obtain the current CSRF token and send `X-CSRF-Token` on authenticated mutations.

| Route | JSON body / result |
| --- | --- |
| `POST /api/auth/register` | `{username,password}` → user, csrf, recoveryCode |
| `POST /api/auth/login` | `{username,password}` → user, csrf |
| `POST /api/auth/recover` | `{username,recoveryCode,password}` → new session and new recoveryCode; revokes old sessions |
| `GET /api/auth/me` | `{user,csrf}`; both null when signed out |
| `POST /api/auth/logout` | Revokes this session |
| `DELETE /api/account` | `{password}`; deletes account, spots and sessions |

Usernames contain 3–32 letters, digits or underscores and are normalized to lowercase. Passwords are 12–128 characters. Recovery codes are shown once; the server retains only their hash. There is no email reset flow. Sessions expire after 30 days.

## Private spots

`GET /api/spots` returns `{spots:[...]}` for the signed-in user. `POST /api/spots` creates a spot; `PUT /api/spots/{id}` replaces its editable fields; `DELETE /api/spots/{id}` removes it.

```json
{
  "name": "Forest walk",
  "lat": 47.3,
  "lon": 8.55,
  "species": "porcini",
  "cellId": "zh:100-100",
  "notes": "Check after rain."
}
```

The example cell identifier is illustrative. Use actual identifiers returned by the habitat index. Names are at most 100 characters, notes 2,000, and accounts can save 500 spots. Coordinates must fall within Switzerland's bounding rectangle; that check does not establish whether a point is within Swiss territory or safe to access. Each spot has a UUID and creation/update timestamps. Owners cannot read or modify another user's spots; non-owned IDs return 404. No public sharing endpoint exists.

## Limits

Per source IP, per minute: 240 API requests, 10 authentication attempts, 30 authenticated writes. Request bodies are limited to 16 KB. Scrypt work is limited to two concurrent password operations. HTTP 429 includes `Retry-After`; clients should back off. Limits are in memory and suitable for a single instance.
