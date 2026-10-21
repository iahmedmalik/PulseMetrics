# PulseMetrics

Product analytics for small apps: a tiny snippet sends named events, and you see where people drop off (funnel), how many browsers are active each day, and whether version B really beat version A (with a p-value). No cookies, no page addresses, no personal data.

**Status:** under construction (v1 in progress).

## How it is laid out

| Folder | What it is |
|---|---|
| `web/` | The dashboard (Next.js, TypeScript) |
| `api/` | The API (Express, TypeScript) on Neon Postgres |
| `packages/core/` | Pure logic shared by both: event rules, A/B statistics, funnel shaping |

## Run the checks

```
npm ci
npm run typecheck
npm test
npm run build
```

Needs Node 22.

## Licence

MIT
