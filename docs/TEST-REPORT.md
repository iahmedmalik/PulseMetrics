# PulseMetrics: test report (v1 prototype, 21 Oct 2026)

All runs on the author's Windows 10 computer, Node 22, a real local Postgres, the production build of the dashboard. Nothing here was run against a deployed system.

| Suite | Result |
|---|---|
| Type check (all workspaces) | passes |
| Core logic (Vitest, `packages/core`) | 103 of 103 passed |
| API and database (Vitest, real Postgres) | 155 of 155 passed |
| Browser (Playwright, 203 runs: desktop Chrome, 375 px phone, desktop Edge for `@core`) | 199 passed, 4 skipped, 0 failed (8.5 min) |

The 4 skips are tests that do not apply to the view they were listed in: the phone touch-target checks in desktop Chrome, and the hover and top-bar checks in the 375 px view.

## Defects found by testing, and fixed

1. A repeated API test run failed because a fixed site key collided with data kept from the previous run. Fix: random keys (`test:` commit "update the health check test and use a random key").
2. The contrast test found the edge of fields and buttons was only 2:1 on the page. Fix: a stronger `--line-strong` border token (at least 3:1).
3. The first snippet browser test was blocked by Chrome's rule against made-up web addresses calling `localhost`. This was a test set-up fault, not a product defect; the test now serves the page from a real local server.

## What is not measured

- "Ask your data": the guard rails, tools, limits and error paths pass with a scripted model (22 tests). The real model has not been called, so the 10-question eval (`api/evals/ask-eval.ts`) has **no result yet**, and no accuracy figure is claimed.
- The enabled Ask screen has no browser test (the test stack has no model key); the not-set-up screen does.
- No real-phone test, no deployed-system test, no usability sessions, no load test.
- No real users: any event counts seen in the apps are test traffic or the author's own use.
