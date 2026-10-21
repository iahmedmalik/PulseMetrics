# Metrics plan: QueueCare and CommitteeKeeper

This plan says what to measure in each of the two apps that have the PulseMetrics snippet installed, which numbers PulseMetrics v1 can really show, and what each number would tell you to do. It contains no figures on purpose: neither app has real users yet, so anything counted today is test traffic or the author's own use. When numbers are quoted in a README they must be labelled that way, and never called adoption.

## How measuring works (and what it cannot do)

- Every event is a fixed name plus a random browser id. A browser id is **one browser**, not one person, and it is different on every device.
- That decides what a funnel can mean. A funnel follows one browser through steps, so **every step of a funnel must happen on the same device**. A step done on the receptionist's computer and the next step done on a patient's phone can never be joined.
- v1 shows: daily active browsers, funnels (2 to 6 steps, in order), the list of event names and a live feed, and an A/B calculator. It does not yet show "how many times per day was this event sent" for one event name. Metrics that need that are marked **later**.

## QueueCare

Events (all sent by the patient's phone, except the last):

| Event | When |
|---|---|
| `status_viewed` | a patient opens their status page |
| `step_out_advice_seen` | the page tells them they can step out |
| `called_in` | the page says "Please go in now" |
| `patient_registered` | reception issues a token (sent from the reception computer) |

### North-star metric

**Patients who saw "Please go in now" on their own phone.** It is the moment the product keeps its promise: the patient was able to wait elsewhere and was told, on their phone, exactly when to come in. In PulseMetrics: the number of browsers in the last step of the funnel below.

### Three supporting metrics

| # | Metric | What it tells you | How to read it in PulseMetrics v1 |
|---|---|---|---|
| 1 | **Stay-with-the-page rate**: of the browsers that opened a status page, the share that reached "Please go in now" | Whether patients trust the page enough to leave it open and wait for it | Funnel: `status_viewed` → `step_out_advice_seen` → `called_in`, read the last "of the first step" percentage |
| 2 | **Step-out adoption**: of the browsers that opened a status page, the share that were told they could step out | Whether the page is used early enough to help (the wait is long enough to leave) | The same funnel, the second step's "of the first step" percentage |
| 3 | **Patients per day**: daily active browsers on the QueueCare site | How busy the clinic's day was, as seen from patients' phones | Innings page: daily active browsers (reception and doctor computers add a few browsers; they are few) |

Later, when event counts per day exist: **status-page reach** = patients' browsers that opened a status page ÷ tokens issued that day.

### What each number would change

- Metric 1 low, with a large drop between steps 1 and 2: patients open the page once and leave. Look at what the first screen says before the advice shows.
- Metric 2 low: most patients are told to stay. The step-out threshold may be too tight, or waits are short and the feature is not needed there.
- Metric 3 flat at a handful of browsers: the clinic is not giving patients the link or QR code. That is an onboarding problem, not a product problem.

## CommitteeKeeper

Events:

| Event | When | Device |
|---|---|---|
| `committee_started` | an organiser starts a committee | the organiser's |
| `payment_recorded` | an organiser saves a payment | the organiser's |
| `member_link_opened` | someone opens a member's private page | the member's |

### North-star metric

**Organisers who record a payment in a week.** The product exists to keep an honest record of who paid. An organiser who keeps recording payments is using it for its purpose. In PulseMetrics: daily active browsers, filtered in your head to the organiser's device; or, more exactly, the number of browsers in the last step of the funnel below.

### Three supporting metrics

| # | Metric | What it tells you | How to read it in PulseMetrics v1 |
|---|---|---|---|
| 1 | **Activation**: of the organisers who started a committee, the share who then recorded a payment | Whether starting a committee leads to real use | Funnel: `committee_started` → `payment_recorded` (both on the organiser's device) |
| 2 | **Member reach**: daily active browsers that opened a member page | Whether members actually use their private links | Daily active browsers is mixed with organisers; the live feed shows `member_link_opened` rows. **Later**: events per day for `member_link_opened` |
| 3 | **Active days**: how many different days in a month had any activity | Whether committees are being kept up month after month | Innings page, 30-day range |

### What each number would change

- Activation low, with many `committee_started` and few `payment_recorded`: organisers set a committee up and stop. Look at the screen right after starting.
- Member reach near zero while payments are recorded: members are not being given their links, or do not find them useful. Look at how the link is shared (the copy-link and QR buttons).
- Active days thin in the middle of a month: a committee that should be running has gone quiet.

## A/B tests

Use the calculator to compare two versions of one thing (for example two wordings of the first screen). Decide how many people you need **before** you start, look once at the end, and treat "not enough evidence yet" as an answer, not a failure. A real difference can still be small, so read the size of the gap as well as the p-value.

## What this plan does not claim

- It does not claim any user numbers. Today the only traffic is tests and the author's own use.
- It does not claim that browsers equal people. One person on two devices is two browsers.
- Two of the metrics above need event counts per day by name, which PulseMetrics v1 does not show yet. They are listed as **later** rather than approximated.
