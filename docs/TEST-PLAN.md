# PulseMetrics: test plan

## What is tested, and where

| Layer | Tool | What it proves |
|---|---|---|
| Core logic (`packages/core`) | Vitest | Event-name and key rules, funnel shaping, daily series, A/B statistics against textbook answers, Pakistan-time days, colour contrast of the palette |
| API and database (`api`) | Vitest + a real Postgres | Every route, the numbered migrations, the three database roles, row-level security, rate limits, retention, the snippet's one public door, "Ask your data" with a scripted model |
| Whole product (`web/e2e`) | Playwright | Sign-up to funnel in a real browser, the install snippet on a real second website, accessibility, layout and touch targets on a 375 px phone |
| The two apps that send events | Their own Playwright tests | QueueCare and CommitteeKeeper send only fixed event names, never a private link |

The API tests run against a real Postgres started on the computer (not a mock), because the rules that matter most (row-level security, the funnel function, the one-way insert door) live in the database.

## Choosing the cheapest reliable test

Use the lowest layer that can actually observe the risk. More tests are not automatically more confidence.

| Change or question | First proof | Before push | Release/deploy proof |
|---|---|---|---|
| Pure calculation, validation or formatting | Focused Vitest test in `packages/core` | Core suite + typecheck | Included in normal CI; no browser duplicate unless users interact with it |
| API route, authentication, database policy or SQL report | Focused API/database integration test against real Postgres | API suite + typecheck | Smoke the affected public journey after deploy |
| One component interaction or defect | One focused Playwright sanity/regression test in desktop Chrome | `@smoke` plus build/typecheck | Repeat the focused case on phone/Edge only when viewport or browser behaviour is part of the risk |
| Layout, touch target, responsive navigation or accessibility | Focused `@mobile` Playwright test | Phone project + relevant Chrome check | Deployed phone smoke and a real-phone check |
| Cross-cutting shell/auth/routing change | Focused regression plus `@smoke` in all three projects | Full Chrome regression if several screens are affected | Full regression, then deployed smoke |
| Release candidate | All unit/API suites, build, full Playwright regression | Required | Deployed smoke in Chrome, Edge and 375 px; real-phone check |

**Sanity** means the smallest focused check that proves the changed thing works. Run a named file/test, for example `npx playwright test e2e/shell.spec.ts --grep "New site" --project desktop-chrome`.

**Smoke** is the small `@smoke` set of critical journeys: sign-in protection and sign-up, shell navigation and New site, install snippet, public event/P-1 ingestion, daily and funnel reports, and an A/B verdict. It answers “is the product's backbone still alive?” Run `npm run test:smoke` locally (build included), `npm run test:smoke:run -w @pulse/web` when a valid production build is already running, or set `E2E_BASE_URL` for the deployed site.

**Targeted regression** is a test added for a real defect and tagged `@regression`. Run the affected test after its fix and keep it in the full Chrome suite. A regression tag does not automatically multiply the test across browsers.

**Full regression** is every browser test in desktop Chrome plus the selected phone and Edge repeats below. Run `npm run test:regression`. Use it for releases, cross-cutting changes and explicit risk—not automatically after every small copy, link or isolated logic fix.

## Browsers, devices and tags

- Desktop Chrome runs all browser tests once and is the complete browser regression.
- The 375 px phone project runs only `@mobile` and `@smoke` tests.
- Desktop Edge runs only `@smoke` tests.
- `@mobile` means the evidence depends on viewport, touch, responsive layout or phone accessibility.
- `@smoke` means a critical end-to-end journey worth repeating in all three environments.
- `@regression` records a real defect. It runs in Chrome unless it also carries `@mobile` or `@smoke` for a concrete reason.

Do not add E2E coverage when a unit or API/database test proves the same behavior more directly. Do not delete coverage only to lower a count: move repeated evidence to the appropriate layer or project.

The smoke set contains seven tests (21 runs across three projects). Its event journey creates a site, rejects an extra privacy field, sends two valid events through HTTP and verifies Install, daily activity and the funnel. It needs no direct database credentials. It creates labelled test accounts and sites, so use a designated test deployment or an explicitly approved production test window. Production sign-up rate limits still apply; serialize or space runs if they return 429 rather than bypassing the protection.

Use `--reporter=dot` for routine runs and inspect retained traces only on failure. List tests instead of executing them when verifying selection/tag changes. Reuse an already verified production build for test-only changes; rebuild after application code or build configuration changes. Record actual results and duration, and keep test failures distinct from launcher/environment failures. A smoke pass covers critical flows; it does not prove every feature is regression-free.

## Risk-based priorities

1. **P-1: no address, token or personal data can be stored.** Tested at four levels: the body schema refuses extra fields; the database has no column for them; a real second website sends an event and the stored row is just a name and a browser id; QueueCare's private status link is proven absent from every call.
2. **One owner never sees another's data.** The database roles are checked by a script that acts as each role; routes answer 404 for another owner's site.
3. **Statistics never mislead.** Known textbook cases to three decimals; "not enough evidence" is never turned into a win; a small-sample warning under 30 people.
4. **The public door survives abuse.** Rate limits per visitor and per key, a 1 KB body cap, a per-site event cap.
5. **Accessibility.** WCAG 2.2 AA scan of every screen (empty states included) in desktop and phone views, plus a contrast test of the palette.
6. **"Ask your data" cannot be talked into anything.** Four fixed read-only tools, strict inputs, no site id for the model to choose, a step cap and a daily limit.

## Not covered (said plainly)

- The real language model is not called by any automated test. A 10-question eval against it is written (`api/evals/ask-eval.ts`) but has not been run, so no pass rate is claimed yet.
- The enabled "Ask" screen (typing a question and reading an answer) has no browser test, because the test stack has no model key. The not-set-up screen does.
- Real phones and the deployed system have not been tested yet. Usability testing with first-time users has not been done.
- Load and performance testing beyond the rate limits.

## Defects

Defects found by testing are recorded in the test report and fixed with `fix:` commits.
