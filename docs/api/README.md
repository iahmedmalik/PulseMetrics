# PulseMetrics API guide

The API is a standalone Express service. Every dashboard screen is a thin view over these routes, so everything the dashboard does you can do by hand. The examples use `curl` against a local API (`http://localhost:4000`). Replace the cookie and ids with your own.

Errors are always JSON `{ "error": "plain sentence" }` with a status code that means something: 400 invalid, 401 not signed in, 404 not found or not yours, 405 wrong method, 429 limit reached, 502 an outside service failed, 503 a feature is not set up.

## 1. The public door: `POST /v1/track`

Anyone's page may call it, with no cookies. The body is exactly three fields; anything else is refused.

```
curl -i -X POST http://localhost:4000/v1/track \
  -H "content-type: application/json" \
  -d '{"key":"<24-character site key>","anon":"k3j9x0a2b7c4d8e1","name":"queue_joined"}'
```

| Result | Meaning |
|---|---|
| `204` | stored |
| `400` | bad name (`^[a-z][a-z0-9_]{1,39}$`), a bad `anon` (16 to 32 lowercase letters and digits), or an extra field |
| `404` | unknown site key |
| `429` | more than 120 requests a minute from one address, 1,200 a minute for one key, or the site hit its 200,000 event cap |

Try the privacy rule yourself: add `"page":"/m/secret-token"` to the body. It is refused with 400, and nothing is stored.

## 2. Sign in (Better Auth)

```
curl -i -X POST http://localhost:4000/v1/auth/sign-up/email \
  -H "content-type: application/json" -H "origin: http://localhost:3400" \
  -d '{"name":"Me","email":"me@example.com","password":"a-long-enough-password"}'
```

The response sets a session cookie. Send it back as `-H "cookie: <value>"` on the routes below. The `origin` header is required: the API checks it on every state-changing call.

## 3. Owner routes (need the cookie; you only ever see your own sites)

| Route | What it does |
|---|---|
| `GET /v1/me` | who is signed in |
| `GET /v1/sites` | your sites, with event counts |
| `POST /v1/sites` `{ "name": "QueueCare" }` | make a site (returns its key once; it can be shown again) |
| `GET /v1/sites/:id` | one site |
| `PATCH /v1/sites/:id` `{ "name": "…" }` | rename |
| `POST /v1/sites/:id/rotate-key` | new key; the old one stops working at once |
| `DELETE /v1/sites/:id` | delete the site and every event |
| `GET /v1/sites/:id/daily?days=14` | active browsers per day (7, 14 or 30) |
| `GET /v1/sites/:id/funnel?steps=a,b,c&days=14` | people at each step, in order |
| `GET /v1/sites/:id/names` | event names the site has sent, with counts |
| `GET /v1/sites/:id/recent` | the latest events (name and time only) |
| `GET /v1/ask/status` | is "Ask" set up, the daily limit, and how many you have used |
| `POST /v1/ask` `{ "siteId": "…", "question": "…" }` | ask in plain words (300 characters at most) |

```
curl "http://localhost:4000/v1/sites/<id>/funnel?steps=queue_joined,status_viewed,called_in&days=14" \
  -H "cookie: <session cookie>"
```

A site that is not yours answers 404, the same as one that does not exist.

## 4. Housekeeping: `POST /internal/retention`

Deletes events older than 180 days. It needs `Authorization: Bearer <CRON_SECRET>` and is meant to be called once a day by a scheduler. `GET /health` answers `{ "status": "ok", ... }` for uptime checks.

## 5. A first manual test, step by step

Open the saved [tracking request collection](tracking.http) in an HTTP client that supports `.http` files, such as VS Code REST Client. Set `siteKey` to a development site's public key before sending the valid-event request. The collection contains no passwords or session cookies. A successful health check proves the API is running; the unknown-key request also checks the API's database connection.

1. `POST /v1/track` with a made-up key → expect `404`. (The door is closed to strangers.)
2. Sign up, make a site, copy its key.
3. `POST /v1/track` with the real key, three different `name` values and the same `anon` → expect `204` each time.
4. `GET /v1/sites/:id/names` → the three names appear.
5. `GET /v1/sites/:id/funnel?steps=…` with those names in order → one person at every step.
6. `POST /v1/track` with an extra field → `400`. Check `names` again: nothing new was stored.
