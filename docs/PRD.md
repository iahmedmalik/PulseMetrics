# PulseMetrics: Product Requirements (v1.0)

This is the PRD that v1.0 was built from. It makes no claim about real users: the numbers in section 7 are measurable properties of the product, and any usage figures quoted elsewhere are labelled as test or own traffic.

## 1. Problem
Small apps cannot afford Mixpanel or similar tools, so their builders do not know where users drop off or whether a change helped. Free alternatives are either heavy to set up, collect personal data, or show numbers without saying how far to trust them.

## 2. Target user
Solo builders and tiny teams with one to five small apps. They check results briefly, often on a phone, and decide what to fix next. The first user is the author, with two other apps (QueueCare and CommitteeKeeper).

## 3. Goals
G1. Answer "where do people drop off?" with a funnel (users per step, conversion % per step and overall).
G2. Show daily active users over time.
G3. Say whether version B beat version A, with a p-value and a plain-English verdict that warns when samples are small.
G4. Collect the least data possible (rule P-1).
G5. Install in minutes: one script tag, named events.

## 4. Non-goals
Session recording, heatmaps, user ids, cohorts, exports, team accounts, alerts, mobile SDKs, ad tracking, real-time dashboards.

## 5. Privacy rule P-1 (written rule)
PulseMetrics never stores a page address, query string, token, name, phone number, email address or anything about health. The snippet sends only a fixed event name chosen in the host app's code (for example `member_page_viewed`, `queue_joined`) and a random browser id. It never reads the page address. No cookies, no IP address stored, Do Not Track respected. The server refuses anything else: event names must match `^[a-z][a-z0-9_]{1,39}$`, unknown fields are rejected, and there is no free-text column in the events table. Reason: apps often carry private tokens in their addresses (a member link, a patient status link), and an analytics database must never become a second place a token can leak from.

## 6. User stories and acceptance criteria
**US-1 Sign up and sign in (Must).** As an owner I sign up and sign in with email and password (Better Auth).
- AC: wrong password gives a clear message; signed-out visitors cannot open the dashboard; I only ever see my own sites.

**US-2 Create a site and get the snippet (Must).** I name a site and copy its install snippet.
- AC: snippet is one script tag plus a one-line call per event; key can be shown again and replaced; replacing the key stops the old one working.

**US-3 Track events (Must).** The snippet sends a named event to `POST /v1/track`.
- AC: a valid event is stored (204); a bad name, unknown field or unknown key is refused (400/404); more than the rate limit is refused (429); the page is never slowed or broken if PulseMetrics is down; Do Not Track sends nothing; tests prove no address or token is ever stored (P-1).

**US-4 Funnel (Must).** I choose 2 to 6 event names in order and a date range and see users per step and conversion %.
- AC: a user counts at step n only if they did steps 1..n in that order; each step shows count, % of previous step, % of first step; fewer than 30 users at step 1 shows "small sample"; empty data shows a helpful empty state; a text table is available for the chart.

**US-5 Daily active users (Must).** I see unique browsers per day for a range.
- AC: days follow Pakistan time; today is marked partial; the same browser counts once per day; a table alternative exists.

**US-6 A/B calculator (Must).** I enter visitors and conversions for A and B and get rates, difference and p-value.
- AC: two-sided two-proportion z-test; known textbook cases match to 3 decimals; zero visitors, zero conversions and equal rates do not crash; verdict never says "B wins" unless p < 0.05, and says "not enough evidence" otherwise; small-sample warning when any group has under 5 expected conversions or non-conversions; explains in one sentence what the p-value does and does not mean. Can fill from two funnel/event counts (Should).

**US-7 Privacy page (Must).** One page that says what is and is not collected, shown in the app footer and linked from the install page.

**US-8 How it's built (Must).** Top-bar page: who built it, the story, the problem, the stack, the architecture, the tests, links and credits. The main screens stay a product for real users.

**US-9 Rate limiting and abuse limits (Must).** Per key and per short-lived bucket; body size cap; refusals are counted, not stored with identity.

**US-10 Install in two real apps (Must).** Named events only (QueueCare: `status_viewed`, `step_out_advice_seen`, `called_in`, `patient_registered`; CommitteeKeeper: `committee_started`, `payment_recorded`, `member_link_opened`). Each app gets its own change and a line on its privacy page.
- AC: a browser test in each app captures the request and shows no token or address (P-1).

**US-11 Metrics plan (Must).** For each app: a north-star metric and three supporting metrics, with the funnel that measures them. Numbers quoted in READMEs are labelled test/own traffic until real users exist.

**US-12 Ask your data (Should).** I type a question; the model may call only four read-only reports (event names, funnel, daily active users, A/B comparison) and explains the answer.
- AC: it never writes SQL and is never given a site id; it only reads the signed-in owner's data for the site the question was asked about; out-of-scope questions get a plain "I can't answer that"; scripted-model tests cover the guard rails; a 10-question eval against the real model reports its pass count (written, not yet run: see the test report); at most 5 tool rounds per question, 300-character questions and a per-owner daily limit; switched off with an honest "not set up" page unless a key is configured.

## 7. Success metrics (honest)
- Technical: funnel and A/B tests match known answers; role check shows no cross-owner read; snippet under 1 KB; `/api/track` p95 under 300 ms from a script.
- Product (own use only, labelled): events from both apps arrive; the funnels for the two apps can be read without help by 3 test users (P1 to P3, 10-minute sessions: task completion and where they stumble).
- A written metrics plan per app. Evidence of real adoption: none yet, and none is claimed.

## 8. Risks
| Risk | Plan |
|---|---|
| Token or personal data leaks into events | P-1, validation, tests in both apps |
| Public endpoint abused or flooded | rate limit, size cap, name pattern, key check, cheap to reject |
| Misleading statistics (peeking, small n) | small-sample warning, verdict wording, explanation text |
| Touching released apps breaks them | snippet never throws; one commit per app; smoke set before and after |
| Free tiers sleep: Render API after 15 minutes idle (about a minute to wake), Neon compute after 5 minutes; 1 GB storage | external pinger keeps the API awake from 9 am to 6 pm Pakistan time (about 285 of 750 free hours a month) and lets it sleep overnight; snippet never waits, times out at 5 s and retries unsent names on the next page view; 180-day retention and a per-site event cap; friendly waking-up state on the dashboard |
| Schedule (plan ends 26 Oct) | AI feature cut first; record the slip honestly |
| Day boundary confusion | Pakistan time, stated on the chart |

## 9. Open questions
A short usability test with first-time users (not yet run).
