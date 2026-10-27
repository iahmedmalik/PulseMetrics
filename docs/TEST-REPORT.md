# PulseMetrics: test report (v1.0, 27 Oct 2026)

## Release run (commit `28d61d9`)

On the author's Windows 10 computer: Node 22, a real local Postgres, the production build of the dashboard.

| Suite | Result |
|---|---|
| Type check | passes |
| Core logic (Vitest, `packages/core`) | 103 of 103 passed |
| API and database (Vitest, real Postgres) | 158 of 158 passed |
| Browser (Playwright, 142 runs: every test in desktop Chrome, layout/touch/accessibility checks also at 375 px, the `@smoke` set also in desktop Edge) | 140 passed, 2 skipped, 0 failed (7.7 min) |

The 2 skips are tests that do not apply to the view they are listed in.

## Live site (https://pulsemetrics-delta.vercel.app, API on Render)

| Check | Result |
|---|---|
| `@smoke` set against production, desktop Chrome, 375 px and desktop Edge | 21 of 21 passed |
| Public pages: accessibility scan (axe), console errors, sideways scroll, at 1280 and 375 px | 0 violations, 0 errors, no sideways scroll |

The live API allows 5 sign-ups a minute from one address (abuse protection). Every smoke test makes a fresh account, so a run against production has to be paced: one browser at a time, with a minute between batches. Without that, tests fail with `429 Too many requests`, which is the protection working, not a defect.

## Defects found by testing, and fixed

Before v1.0 (release audit and checks, 27 Oct):

- No page transition between dashboard pages: the template sat above the route group and never remounted (#33).
- The daily page's heading drawing showed the same rising bars for every site, whatever its numbers (#35).
- Setup and navigation crowding, Ask as a dead end, no loading state, A/B placeholders that looked typed in (#36, #37).
- Phone touch targets 1 to 2 px under 44 px, two raw colours, funnel numbers arriving late (#38).
- Caught by the browser tests before commit: making the header's New site an outline button hid it on phones (a phone rule hid every non-primary header button). Fixed in the same change.

Earlier (21 Oct):

1. A repeated API test run failed because a fixed site key collided with data kept from the previous run. Fix: random keys (`test:` commit "update the health check test and use a random key").
2. The contrast test found the edge of fields and buttons was only 2:1 on the page. Fix: a stronger `--line-strong` border token (at least 3:1).
3. The first snippet browser test was blocked by Chrome's rule against made-up web addresses calling `localhost`. This was a test set-up fault, not a product defect; the test now serves the page from a real local server.

## What is not measured

- "Ask your data": the guard rails, tools, limits and error paths pass with a scripted model (22 tests). The 10-question eval (`api/evals/ask-eval.ts`) has **no result yet**, so no accuracy figure is claimed.
- The enabled Ask screen has no browser test (the local test stack has no model key); the switched-off screen does.
- No usability sessions, no load test. The real-phone check is recorded separately when done.
- No real users: any event counts seen in the apps are test traffic or the author's own use.
