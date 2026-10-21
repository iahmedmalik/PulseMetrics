# QueueCare: how PulseMetrics is wired in

QueueCare (a live clinic queue) sends four fixed event names to PulseMetrics. The change is one commit in the QueueCare repository ("measure use with PulseMetrics using four fixed event names, and a privacy page").

| Event | Sent by | When |
|---|---|---|
| `status_viewed` | the patient's phone | the patient opens their status page |
| `step_out_advice_seen` | the patient's phone | the page tells them they can step out |
| `called_in` | the patient's phone | the page says "Please go in now" |
| `patient_registered` | the reception computer | reception issues a token |

## What it does not send

A patient's status page is `/status/<32 characters>`: the characters are a private link. The page address is never read, never passed to the snippet and never sent. Only the event name goes, with the random browser id the snippet makes.

A browser test in QueueCare registers a patient, opens the patient's private link in a fresh browser with a stand-in snippet that records every call, and checks that every call is exactly one argument from the fixed list and that none contains the link.

## Switching it on

It is off unless all three settings exist when QueueCare is built:

```
NEXT_PUBLIC_PULSE_KEY   the site key from the PulseMetrics dashboard (Sites, Key)
NEXT_PUBLIC_PULSE_SRC   the dashboard's snippet address, for example https://<dashboard>/p.js
NEXT_PUBLIC_PULSE_API   the PulseMetrics API address
```

Set them in the hosting settings, never in the repository, and redeploy.

## Where it lives in the code

- `src/lib/pulse.ts`: the only function that sends an event, and the list of allowed names
- `src/components/PulseSnippet.tsx`: adds the snippet only when the three settings exist
- `src/components/PulseEvent.tsx`: sends one event when a piece of the page appears
- `src/app/privacy/page.tsx`: a public page saying what is counted and what is never sent
