// Everything on the "How it's built" page. Numbers come from the real test runs and are refreshed at release.

export const REPO = "https://github.com/ahmed-malikk/PulseMetrics";

export const COUNTS = {
  // vitest in packages/core, vitest in api (needs a real local Postgres), and Playwright test runs
  // (each test counted once per browser it runs in) as listed by `playwright test --list`
  coreTests: 103,
  apiTests: 158,
  browserRuns: 131,
};

// The two paragraphs below are written from the project's verified facts (the PRD, the decisions made along the way).
// They are Ahmed's story to rewrite in his own words.
export const WHO_BUILT_IT = [
  "I'm Ahmed Malik, a computer science graduate from UET Lahore. PulseMetrics is the fifth project in a ten-project portfolio I am building to work as a developer, a business analyst or a project manager.",
  "I built it end to end: the tracking snippet, the API, the database rules, the dashboard and the tests.",
];

export const THE_STORY = [
  "Small apps can't afford a tool like Mixpanel, so their builders never learn where people drop off. I wanted to see how product analytics works by building the whole thing: a snippet that sends events, an API that receives them, a database that keeps them, and charts that answer two questions, where do people leave and did the new version really win.",
  "The two apps I wanted to measure first, QueueCare and CommitteeKeeper, put private links in their page addresses: a patient's status link, a member's payment link. An analytics tool that records page addresses would have copied those links into a second database. So the first rule I wrote (P-1) was that PulseMetrics never stores an address, a token, a name, a phone number or an email, only a fixed event name and a random browser id, and I made the server and the database refuse anything else.",
  "I also chose to learn how to build a real backend on my own: a standalone Express API on Render with Neon Postgres, rather than keeping everything inside the dashboard. Render's free plan puts the API to sleep when nobody uses it, so the snippet is built to give up quickly and retry later instead of ever slowing down the app it sits in.",
];

export const PROBLEM =
  "Small apps can't afford product analytics, so their builders don't know where users drop off, and the free alternatives either collect personal data or show numbers without saying how far to trust them.";

export const STACK: { group: string; items: string[] }[] = [
  { group: "Dashboard", items: ["Next.js 16", "React 19", "TypeScript", "Vercel"] },
  { group: "API", items: ["Express 5", "TypeScript", "zod", "Better Auth", "Drizzle ORM", "Render"] },
  { group: "Database", items: ["Postgres on Neon", "row-level security", "numbered SQL migrations"] },
  { group: "Tests", items: ["Vitest", "Playwright", "axe-core", "embedded Postgres"] },
];

export const DECISIONS = [
  { title: "Nothing private can get in", text: "The event is exactly three fields. The server refuses any other field, the event name must match a pattern the database enforces too, and tests prove no address, token, name, phone or email is ever stored." },
  { title: "Owners only see their own data", text: "Every dashboard request tells the database who is signed in, and row-level security hides everyone else's rows. The public tracking route runs as a separate database role that can run one function and nothing else." },
  { title: "Honest statistics", text: "The A/B calculator never says a version won unless p is under 0.05 and the sample is big enough, and it explains that the p-value is not the chance that a version is better. The funnel warns when fewer than 30 people started." },
  { title: "Built for free hosting that sleeps", text: "The API sleeps after 15 quiet minutes. A free pinger keeps it awake, the dashboard shows a waking-up state, and the snippet times out after 5 seconds and retries the event names on the next page view." },
  { title: "Days follow Pakistan time", text: "Daily counts split at midnight in Pakistan (UTC+5), and a test pins the exact boundary at 19:00 UTC." },
];

export const HONEST_LIMITS = [
  "No one outside the author has used it yet, so any usage numbers quoted anywhere come from test traffic or the author's own apps and are labelled that way.",
  "Safari and Firefox are not tested; the browser tests run in Chrome, Edge and a 375 px phone view.",
  "The free hosting plans sleep when idle, so the first visit after a quiet spell can take about a minute.",
];

export const LINKS = [
  { label: "Source code on GitHub", href: REPO },
  { label: "README", href: `${REPO}#readme` },
  { label: "Product requirements (PRD)", href: `${REPO}/blob/main/docs/PRD.md` },
  { label: "Test plan and report", href: `${REPO}/blob/main/docs/TEST-REPORT.md` },
  { label: "API reference", href: `${REPO}/blob/main/docs/api/README.md` },
];

export const CREDITS = {
  libraries: ["Next.js and React", "Express", "Better Auth", "Drizzle ORM", "zod", "node-postgres (pg)", "express-rate-limit", "Playwright and axe-core", "Vitest", "embedded-postgres", "esbuild and tsup"],
  fonts: [
    { name: "Barlow Condensed", by: "Jeremy Tribby" },
    { name: "Hanken Grotesk", by: "Hanken Design Co." },
    { name: "Red Hat Mono", by: "Red Hat" },
  ],
};
