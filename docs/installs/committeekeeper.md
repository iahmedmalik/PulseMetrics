# CommitteeKeeper: how PulseMetrics is wired in

CommitteeKeeper (a rotating savings committee tracker) sends three fixed event names to PulseMetrics. The change is one commit in the CommitteeKeeper repository ("measure use with PulseMetrics using three fixed event names, and say so on the privacy page").

| Event | Sent by | When |
|---|---|---|
| `member_link_opened` | the member's browser | someone opens a member's private page |
| `payment_recorded` | the organiser's browser | an organiser saves a payment |
| `committee_started` | the organiser's browser | an organiser starts a committee |

## What it does not send

A member's page is `/m/<43 characters>`: the characters are a private link that shows that member's payments and receipts. The page address is never read, never passed to the snippet and never sent, and the page already tells browsers not to pass its address on. No names, phone numbers or amounts go either, only the event name and the random browser id.

A browser test in CommitteeKeeper makes a committee through the database, opens a member's private link as a stranger with a stand-in snippet that records every call, and checks that every call is exactly one argument from the fixed list and that none contains the link.

## The privacy page had to change

CommitteeKeeper's privacy page said "no analytics". That stopped being true, so the page now has a section, "How the app measures its own use", and the old claim is gone. A test checks both.

## Switching it on

It is off unless all three settings exist when CommitteeKeeper is built:

```
NEXT_PUBLIC_PULSE_KEY   the site key from the PulseMetrics dashboard (Sites, Key)
NEXT_PUBLIC_PULSE_SRC   the dashboard's snippet address, for example https://<dashboard>/p.js
NEXT_PUBLIC_PULSE_API   the PulseMetrics API address
```

Set them in the hosting settings, never in the repository, and redeploy.
