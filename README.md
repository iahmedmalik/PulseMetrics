# PulseMetrics

Product analytics for small apps. A tiny snippet sends named events, and you see where people drop off (funnel), how many browsers are active each day, and whether version B really beat version A, with a p-value and a plain-English verdict. No cookies, no page addresses, no personal data.

**Status:** v1 prototype, built and tested locally. Not deployed yet, so there are no live links in this README. Nobody outside the author has used it, and no usage figures are claimed.

## What it does

| Page | What you get |
|---|---|
| Sites | Make a site, copy its install snippet, replace its key, delete it with every event |
| Innings | Active browsers per day, with today marked as partial (days follow Pakistan time) |
| Funnel | 2 to 6 steps in order: people at each step, the biggest drop, a warning when the sample is small |
| A v B | Two-sided two-proportion z-test; never says "B wins" unless the difference is real |
| Install | The snippet, how to name events, a live "is it arriving?" check, and a live feed of event names |
| Ask | Plain-words questions answered from the same reports (optional; off unless a key is set) |
| Privacy | One page saying what is and is not stored |

## The privacy rule (P-1)

An event is a fixed name chosen in the host app's code plus a random browser id. The snippet never reads the page address, and the server refuses any other field. There is no free-text column, so a private link, name or phone number has nowhere to go. See [docs/PRD.md](docs/PRD.md) and the tests that prove it.

## How it is laid out

| Folder | What it is |
|---|---|
| `web/` | The dashboard (Next.js, TypeScript) |
| `api/` | The API (Express, TypeScript) on Postgres, with Better Auth |
| `packages/core/` | Pure logic shared by both: event rules, funnel shaping, A/B statistics, time, contrast |
| `api/sql/` | Numbered migrations and the database roles |
| `docs/` | PRD, API guide, test plan, test report, metrics plan, lessons |

## Run it on your computer

Needs Node 22. A real local Postgres starts for you; nothing else to install.

```
npm ci
npm run dev:db -w @pulse/api      # local Postgres on port 5433 (leave it running)
cp api/.env.example api/.env.local
npm run db:migrate -w @pulse/api
npm run dev -w @pulse/api         # API on :4000
npm run dev -w web                # dashboard on :3400
```

## Run the checks

```
npm run typecheck
npm test                          # core + API unit and integration tests
npm run build
npm run test:e2e -w web           # builds the dashboard, then runs the browser tests
```

## Documents

- [PRD](docs/PRD.md): the problem, users, stories and acceptance criteria
- [API guide](docs/api/README.md): every route, with requests you can run by hand
- [Test plan](docs/TEST-PLAN.md) and [test report](docs/TEST-REPORT.md)
- [Metrics plan](docs/metrics-plan.md): what to measure in the two apps that will send events
- [Lessons learned](docs/LESSONS.md)
- How the two apps send events: [QueueCare](docs/installs/queuecare.md), [CommitteeKeeper](docs/installs/committeekeeper.md)

## Licence

MIT
