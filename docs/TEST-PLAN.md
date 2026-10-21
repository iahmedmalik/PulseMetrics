# PulseMetrics: test plan

## What is tested, and where

| Layer | Tool | What it proves |
|---|---|---|
| Core logic (`packages/core`) | Vitest | Event-name and key rules, funnel shaping, daily series, A/B statistics against textbook answers, Pakistan-time days, colour contrast of the palette |
| API and database (`api`) | Vitest + a real Postgres | Every route, the numbered migrations, the three database roles, row-level security, rate limits, retention, the snippet's one public door, "Ask your data" with a scripted model |
| Whole product (`web/e2e`) | Playwright | Sign-up to funnel in a real browser, the install snippet on a real second website, accessibility, layout and touch targets on a 375 px phone |
| The two apps that send events | Their own Playwright tests | QueueCare and CommitteeKeeper send only fixed event names, never a private link |

The API tests run against a real Postgres started on the computer (not a mock), because the rules that matter most (row-level security, the funnel function, the one-way insert door) live in the database.

## Browsers and devices

Every browser test runs in desktop Chrome. Layout, touch-target and accessibility checks also run in a 375 px phone view. The core flows (tagged `@core`) also run in desktop Edge. A short `@smoke` set is meant for after a deploy.

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
