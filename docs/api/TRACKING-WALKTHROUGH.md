# How `POST /v1/track` works

This is the public endpoint used by the PulseMetrics browser snippet and by the QueueCare and CommitteeKeeper integrations. It records a fixed event name for a site without receiving a page URL, login cookie, or form data.

## The browser request

The dashboard gives each site a public 24-character key. The snippet is added to a page with that key and the API address:

```html
<script async src="https://YOUR-PULSEMETRICS-WEB/p.js"
  data-key="YOUR_PUBLIC_SITE_KEY"
  data-api="https://YOUR-PULSEMETRICS-API"></script>
```

`/p.js` exposes `window.pulse.track(name)`. The application calls it with a name selected in its own source code, for example `pulse.track("queue_joined")`. The snippet makes this request:

```http
POST /v1/track
Content-Type: text/plain

{"key":"YOUR_PUBLIC_SITE_KEY","anon":"a20characterbrowserid","name":"queue_joined"}
```

The body contains exactly three fields:

- `key`: identifies the one site allowed to receive the event. It is public and can only add events; it is not a password.
- `anon`: a random 20-character browser identifier held in that browser's local storage. It lets reports count a browser across steps without an account or cookie.
- `name`: a fixed event name selected by the app, such as `queue_joined`.

Names must be lowercase, start with a letter, and contain 2–40 lowercase letters, digits, or underscores. The endpoint rejects extra fields, malformed values, and bodies over 1 KB. It does not accept page addresses, tokens, names, email addresses, phone numbers, or other event properties. DNT and Global Privacy Control disable tracking in the snippet. If the network fails or the API returns a server error, the snippet keeps only the event name in a small local queue (up to 20 names) and tries again on a later page view; each request times out after five seconds.

## What the API does

The API validates the exact body and event-name format, applies visitor and site rate limits, and calls the database function `record_event(key, anon, name)` using the ingest-only database connection. That function checks that the site key exists and enforces the site's event cap. The ingest runtime role cannot read or directly write event tables; it can execute this one function.

| Response | Meaning |
|---|---|
| `204` | The event was accepted. The response has no body. |
| `400` | The body or one of its three fields is invalid, or it includes an extra field. |
| `404` | The public site key is unknown. |
| `429` | A rate limit or the site's event cap was reached. |
| `5xx` | The service or database is temporarily unavailable; the snippet queues the event name for retry. |

The public route has no authentication cookie. A database constraint also validates event names. Dashboard reads use the separate app connection and owner-scoped transactions; retention uses the app connection and the protected internal route.

## App integrations

Both integrations use a small typed `track(name)` wrapper. It calls the global snippet only when present and catches errors so analytics cannot break the product. Build-time settings are `NEXT_PUBLIC_PULSE_KEY`, `NEXT_PUBLIC_PULSE_SRC`, and `NEXT_PUBLIC_PULSE_API`; the snippet is omitted unless all three are set. These values are public browser configuration, so never put passwords or database credentials in them.

- **QueueCare** tracks `status_viewed`, `step_out_advice_seen`, `called_in`, and `patient_registered`.
- **CommitteeKeeper** tracks `member_link_opened`, `payment_recorded`, and `committee_started`.

Each app's privacy page lists these fixed names. The integration tests replace the remote snippet with a local stand-in and assert that only one fixed name is passed, including when a private patient/member link is open. This verifies the data boundary without sending test events to production.

For a local request-by-request exercise, use [`tracking.http`](tracking.http). For the full route contract and expected error responses, see the [API guide](README.md).
